package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/vincentmegia/vincentmegia/internal/model"
)

// fakeResumeRepo is an in-memory resumeRepository. failRead/failWrite make
// every read/write return errFakeDB, to exercise the DB-error paths the
// /settings/resume handlers turn into LoadFailed cards.
type fakeResumeRepo struct {
	profile   model.Profile
	roles     []model.Role
	failRead  bool
	failWrite bool
	deleted   []int64
}

var errFakeDB = errors.New("fake db down")

func (f *fakeResumeRepo) GetProfile(context.Context) (model.Profile, error) {
	if f.failRead {
		return model.Profile{}, errFakeDB
	}
	return f.profile, nil
}

func (f *fakeResumeRepo) ListRoles(context.Context) ([]model.Role, error) {
	if f.failRead {
		return nil, errFakeDB
	}
	return append([]model.Role(nil), f.roles...), nil
}

func (f *fakeResumeRepo) write() error {
	if f.failWrite {
		return errFakeDB
	}
	return nil
}

func (f *fakeResumeRepo) UpdateBanner(context.Context, string, string, string, []model.ContactLink, string) error {
	return f.write()
}

func (f *fakeResumeRepo) UpdateExpertise(_ context.Context, g []model.SkillGroup, style string) error {
	if err := f.write(); err != nil {
		return err
	}
	f.profile.SkillGroups, f.profile.SidebarExpertiseFontStyle = g, style
	return nil
}

func (f *fakeResumeRepo) UpdateEducation(context.Context, []model.Education, string) error {
	return f.write()
}

func (f *fakeResumeRepo) UpdateFeaturedProjects(context.Context, []model.FeaturedProject, string) error {
	return f.write()
}

func (f *fakeResumeRepo) UpdateSummary(context.Context, []string, []model.Stat, string) error {
	return f.write()
}

func (f *fakeResumeRepo) CreateRole(_ context.Context, r model.Role) (model.Role, error) {
	if err := f.write(); err != nil {
		return model.Role{}, err
	}
	r.ID = int64(len(f.roles) + 100)
	f.roles = append(f.roles, r)
	return r, nil
}

func (f *fakeResumeRepo) UpdateRole(_ context.Context, r model.Role) (model.Role, error) {
	return r, f.write()
}

func (f *fakeResumeRepo) DeleteRole(_ context.Context, id int64) error {
	if err := f.write(); err != nil {
		return err
	}
	f.deleted = append(f.deleted, id)
	kept := f.roles[:0]
	for _, r := range f.roles {
		if r.ID != id {
			kept = append(kept, r)
		}
	}
	f.roles = kept
	return nil
}

func (f *fakeResumeRepo) MoveRole(context.Context, int64, string) error { return f.write() }

func storedRoles() []model.Role {
	return []model.Role{
		{ID: 1, Title: "Stored One", Company: "Acme", StartDate: time.Date(2020, 1, 1, 0, 0, 0, 0, time.UTC), FontStyle: "organic"},
		{ID: 2, Title: "Stored Two", Company: "Beta", StartDate: time.Date(2018, 1, 1, 0, 0, 0, 0, time.UTC), FontStyle: "editorial"},
	}
}

// TestResumeAdminSave_DBErrorReturnsError verifies every card save returns
// a non-nil error (never a blank view with err == nil) when the DB write
// fails — the signal ResumeAdminHandler turns into a LoadFailed card with
// no submittable form. A blank view reaching the editor would let a
// second Save wipe the card, since the list validators accept empty lists.
func TestResumeAdminSave_DBErrorReturnsError(t *testing.T) {
	ctx := context.Background()
	for _, failRead := range []bool{false, true} {
		// failRead: the write "succeeds" but the re-read fails.
		repo := &fakeResumeRepo{failWrite: !failRead, failRead: failRead}
		svc := &ResumeService{Repo: repo}
		checks := map[string]error{}
		_, checks["banner"] = svc.SaveBanner(ctx, "Role", "Tenure", "Loc", nil, "organic")
		_, checks["expertise"] = svc.SaveExpertise(ctx, nil, "organic")
		_, checks["education"] = svc.SaveEducation(ctx, nil, "organic")
		_, checks["featured"] = svc.SaveFeaturedProjects(ctx, nil, "organic")
		_, checks["summary"] = svc.SaveSummary(ctx, nil, nil, "organic")
		_, checks["create role"] = svc.CreateRole(ctx, "T", "C", "", "2020-01-01", "", "", nil, nil, "organic")
		_, checks["delete role"] = svc.DeleteRole(ctx, 1)
		_, checks["move role"] = svc.MoveRole(ctx, 1, "up")
		for name, err := range checks {
			if !errors.Is(err, errFakeDB) {
				t.Errorf("failRead=%v %s: err = %v, want errFakeDB", failRead, name, err)
			}
		}
	}
}

// TestResumeAdminCreateRole_ValidationKeepsInput verifies a rejected
// create re-renders the stored roles untouched plus the Add-role form
// pre-filled with exactly what was submitted.
func TestResumeAdminCreateRole_ValidationKeepsInput(t *testing.T) {
	svc := &ResumeService{Repo: &fakeResumeRepo{roles: storedRoles()}}
	subs := []model.Subproject{{Heading: "Sub", Bullets: []string{"b1"}}}
	view, err := svc.CreateRole(context.Background(), "Typed Title", "Typed Co", "Typed Loc",
		"not-a-date", "", "Typed blurb", []string{"typed bullet"}, subs, "modern-sans")
	if err != nil {
		t.Fatalf("CreateRole: %v", err)
	}
	if view.Error == "" {
		t.Fatal("expected a validation error")
	}
	if len(view.Roles) != 2 || view.Roles[0].Title != "Stored One" || view.Roles[1].Title != "Stored Two" {
		t.Errorf("Roles = %+v, want the two stored roles unchanged", view.Roles)
	}
	d := view.Draft
	if d.Title != "Typed Title" || d.Company != "Typed Co" || d.Location != "Typed Loc" ||
		d.StartDate != "not-a-date" || d.Blurb != "Typed blurb" ||
		len(d.Bullets) != 1 || d.Bullets[0] != "typed bullet" ||
		len(d.Subprojects) != 1 || d.Subprojects[0].Heading != "Sub" {
		t.Errorf("Draft = %+v, want the submitted values", d)
	}
	if !selectedFont(d.FontOptions, "modern-sans") {
		t.Errorf("Draft font options %+v, want modern-sans selected", d.FontOptions)
	}
}

// TestResumeAdminUpdateRole_ValidationKeepsInput verifies a rejected edit
// shows the submitted values in place of that role's stored ones, while
// every other role keeps its stored content and the Add form stays blank.
func TestResumeAdminUpdateRole_ValidationKeepsInput(t *testing.T) {
	svc := &ResumeService{Repo: &fakeResumeRepo{roles: storedRoles()}}
	view, err := svc.UpdateRole(context.Background(), 2, "", "Edited Co", "", "2019-05-01", "2019-01-01",
		"Edited blurb", []string{"edited"}, nil, "classic-serif")
	if err != nil {
		t.Fatalf("UpdateRole: %v", err)
	}
	if view.Error == "" {
		t.Fatal("expected a validation error for a blank title")
	}
	if len(view.Roles) != 2 {
		t.Fatalf("Roles = %+v", view.Roles)
	}
	if view.Roles[0].Title != "Stored One" || view.Roles[0].Company != "Acme" {
		t.Errorf("untouched role = %+v, want stored values", view.Roles[0])
	}
	r := view.Roles[1]
	if r.ID != 2 || r.Title != "" || r.Company != "Edited Co" || r.StartDate != "2019-05-01" ||
		r.EndDate != "2019-01-01" || r.Blurb != "Edited blurb" || len(r.Bullets) != 1 {
		t.Errorf("edited role = %+v, want the submitted values", r)
	}
	if !selectedFont(r.FontOptions, "classic-serif") {
		t.Errorf("edited role font options %+v, want classic-serif selected", r.FontOptions)
	}
	if view.Draft.Title != "" || !selectedFont(view.Draft.FontOptions, "organic") {
		t.Errorf("Draft = %+v, want blank with organic selected", view.Draft)
	}
}

// TestResumeAdminDeleteRole verifies DeleteRole deletes the given ID and
// returns the list without it.
func TestResumeAdminDeleteRole(t *testing.T) {
	repo := &fakeResumeRepo{roles: storedRoles()}
	svc := &ResumeService{Repo: repo}
	view, err := svc.DeleteRole(context.Background(), 1)
	if err != nil {
		t.Fatalf("DeleteRole: %v", err)
	}
	if len(repo.deleted) != 1 || repo.deleted[0] != 1 {
		t.Errorf("deleted = %v, want [1]", repo.deleted)
	}
	if len(view.Roles) != 1 || view.Roles[0].ID != 2 {
		t.Errorf("Roles = %+v, want only role 2", view.Roles)
	}
}

func selectedFont(opts []FontStyleOption, key string) bool {
	for _, o := range opts {
		if o.Selected {
			return o.Key == key
		}
	}
	return false
}

// TestResolveFontClass verifies allowlisted keys map to their own class
// and an unknown or empty stored key falls back to the organic class.
func TestResolveFontClass(t *testing.T) {
	cases := map[string]string{
		"organic":       "resume-font-organic",
		"classic-serif": "resume-font-classic-serif",
		"modern-sans":   "resume-font-modern-sans",
		"editorial":     "resume-font-editorial",
		"":              "resume-font-organic",
		"comic-sans":    "resume-font-organic",
		"organic\" x=y": "resume-font-organic",
	}
	for key, want := range cases {
		if got := resolveFontClass(key); got != want {
			t.Errorf("resolveFontClass(%q) = %q, want %q", key, got, want)
		}
	}
}
