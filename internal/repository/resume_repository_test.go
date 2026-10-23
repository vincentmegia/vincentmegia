package repository

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"net/url"
	"os"
	"slices"
	"testing"

	"github.com/joho/godotenv"
)

// newTestRolesRepository returns a ResumeRepository whose resume_roles is
// a minimal (id, sort_order) table in a throwaway schema — all MoveRole/
// moveSortOrder and DeleteRole read or write — so the real résumé rows
// are never touched. Same DATABASE_URL gating and schema isolation as
// newTestBusRepository.
func newTestRolesRepository(t *testing.T) (*ResumeRepository, *sql.DB) {
	t.Helper()

	_ = godotenv.Load("../../.env")
	baseURL := os.Getenv("DATABASE_URL")
	if baseURL == "" {
		t.Skip("DATABASE_URL not set (skipping DB-backed resume repository test — see .env.example)")
	}
	ctx := context.Background()

	admin, err := sql.Open("pgx", baseURL)
	if err != nil {
		t.Fatalf("open admin connection: %v", err)
	}
	t.Cleanup(func() { admin.Close() })
	if err := admin.PingContext(ctx); err != nil {
		t.Skipf("database unreachable (%v); skipping", err)
	}

	suffix := make([]byte, 6)
	if _, err := rand.Read(suffix); err != nil {
		t.Fatalf("random schema suffix: %v", err)
	}
	schema := "resume_test_" + hex.EncodeToString(suffix)
	if _, err := admin.ExecContext(ctx, `CREATE SCHEMA `+schema); err != nil {
		t.Fatalf("create schema: %v", err)
	}
	t.Cleanup(func() {
		if _, err := admin.ExecContext(context.Background(), `DROP SCHEMA `+schema+` CASCADE`); err != nil {
			t.Errorf("drop schema %s: %v", schema, err)
		}
	})

	u, err := url.Parse(baseURL)
	if err != nil {
		t.Fatal("parse DATABASE_URL failed") // never echo the URL: it holds the password
	}
	q := u.Query()
	q.Set("search_path", schema)
	u.RawQuery = q.Encode()
	conn, err := sql.Open("pgx", u.String())
	if err != nil {
		t.Fatalf("open schema-scoped connection: %v", err)
	}
	conn.SetMaxOpenConns(2)
	t.Cleanup(func() { conn.Close() })

	if _, err := conn.ExecContext(ctx, `CREATE TABLE resume_roles (id BIGINT PRIMARY KEY, sort_order INTEGER NOT NULL)`); err != nil {
		t.Fatalf("create resume_roles: %v", err)
	}
	return NewResumeRepository(conn, conn), conn
}

// seedRoleOrder replaces resume_roles with ids 1..n at the given
// (deliberately gapped) sort_order values.
func seedRoleOrder(t *testing.T, conn *sql.DB, orders ...int) {
	t.Helper()
	if _, err := conn.Exec(`DELETE FROM resume_roles`); err != nil {
		t.Fatal(err)
	}
	for i, o := range orders {
		if _, err := conn.Exec(`INSERT INTO resume_roles (id, sort_order) VALUES ($1, $2)`, i+1, o); err != nil {
			t.Fatal(err)
		}
	}
}

// roleOrder returns role ids in display order.
func roleOrder(t *testing.T, conn *sql.DB) []int64 {
	t.Helper()
	rows, err := conn.Query(`SELECT id FROM resume_roles ORDER BY sort_order`)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	var ids []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			t.Fatal(err)
		}
		ids = append(ids, id)
	}
	return ids
}

// TestResumeRepository_MoveRole covers moveSortOrder through MoveRole:
// swaps with the immediate neighbour (even across sort_order gaps), and
// no-ops — not errors — at either end, for an unknown direction, and for
// a missing id.
func TestResumeRepository_MoveRole(t *testing.T) {
	repo, conn := newTestRolesRepository(t)
	ctx := context.Background()

	cases := []struct {
		name      string
		id        int64
		direction string
		want      []int64
	}{
		{"middle up", 2, "up", []int64{2, 1, 3}},
		{"middle down", 2, "down", []int64{1, 3, 2}},
		{"last up", 3, "up", []int64{1, 3, 2}},
		{"first down", 1, "down", []int64{2, 1, 3}},
		{"first up is a no-op", 1, "up", []int64{1, 2, 3}},
		{"last down is a no-op", 3, "down", []int64{1, 2, 3}},
		{"unknown direction is a no-op", 2, "sideways", []int64{1, 2, 3}},
		{"empty direction is a no-op", 2, "", []int64{1, 2, 3}},
		{"missing id is a no-op", 99, "up", []int64{1, 2, 3}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			seedRoleOrder(t, conn, 10, 20, 35) // gaps: neighbour, not ±1
			if err := repo.MoveRole(ctx, tc.id, tc.direction); err != nil {
				t.Fatalf("MoveRole: %v", err)
			}
			if got := roleOrder(t, conn); !slices.Equal(got, tc.want) {
				t.Errorf("order = %v, want %v", got, tc.want)
			}
		})
	}

	t.Run("swap keeps the original sort_order values", func(t *testing.T) {
		seedRoleOrder(t, conn, 10, 20, 35)
		if err := repo.MoveRole(ctx, 3, "up"); err != nil {
			t.Fatalf("MoveRole: %v", err)
		}
		var o2, o3 int
		if err := conn.QueryRow(`SELECT (SELECT sort_order FROM resume_roles WHERE id = 2), (SELECT sort_order FROM resume_roles WHERE id = 3)`).Scan(&o2, &o3); err != nil {
			t.Fatal(err)
		}
		if o2 != 35 || o3 != 20 {
			t.Errorf("sort_order id2=%d id3=%d, want 35 and 20", o2, o3)
		}
	})

	t.Run("single row", func(t *testing.T) {
		seedRoleOrder(t, conn, 1)
		for _, d := range []string{"up", "down"} {
			if err := repo.MoveRole(ctx, 1, d); err != nil {
				t.Fatalf("MoveRole %s: %v", d, err)
			}
		}
		if got := roleOrder(t, conn); !slices.Equal(got, []int64{1}) {
			t.Errorf("order = %v", got)
		}
	})
}

// TestResumeRepository_DeleteRole verifies DeleteRole removes exactly the
// given row and reports a missing id as sql.ErrNoRows (which
// ResumeService.DeleteRole treats as success).
func TestResumeRepository_DeleteRole(t *testing.T) {
	repo, conn := newTestRolesRepository(t)
	ctx := context.Background()
	seedRoleOrder(t, conn, 1, 2, 3)

	if err := repo.DeleteRole(ctx, 2); err != nil {
		t.Fatalf("DeleteRole: %v", err)
	}
	if got := roleOrder(t, conn); !slices.Equal(got, []int64{1, 3}) {
		t.Errorf("order after delete = %v, want [1 3]", got)
	}
	if err := repo.DeleteRole(ctx, 2); !errors.Is(err, sql.ErrNoRows) {
		t.Errorf("second DeleteRole err = %v, want sql.ErrNoRows", err)
	}
}
