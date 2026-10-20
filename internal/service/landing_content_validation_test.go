package service

import (
	"strings"
	"testing"
)

func TestValidateHeroInput(t *testing.T) {
	tests := []struct {
		name                          string
		eyebrow, title, message       string
		wantEyebrow, wantTitle, wantM string
		wantErr                       error
	}{
		{
			name: "valid submission", eyebrow: "Software Engineer", title: "Hi", message: "Body",
			wantEyebrow: "Software Engineer", wantTitle: "Hi", wantM: "Body",
		},
		{
			name: "fields are trimmed", eyebrow: "  Software Engineer  ", title: " Hi ", message: " Body ",
			wantEyebrow: "Software Engineer", wantTitle: "Hi", wantM: "Body",
		},
		{name: "empty eyebrow", eyebrow: "", title: "Hi", message: "Body", wantErr: ErrHeroEyebrowRequired},
		{name: "whitespace-only eyebrow", eyebrow: "   ", title: "Hi", message: "Body", wantErr: ErrHeroEyebrowRequired},
		{name: "empty title", eyebrow: "Software Engineer", title: "", message: "Body", wantErr: ErrHeroTitleRequired},
		{name: "empty message", eyebrow: "Software Engineer", title: "Hi", message: "", wantErr: ErrHeroMessageRequired},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ValidateHeroInput(tt.eyebrow, tt.title, tt.message)
			if tt.wantErr != nil {
				if err != tt.wantErr {
					t.Fatalf("ValidateHeroInput() error = %v, want %v", err, tt.wantErr)
				}
				return
			}
			if err != nil {
				t.Fatalf("ValidateHeroInput() unexpected error: %v", err)
			}
			if got.Eyebrow != tt.wantEyebrow || got.Title != tt.wantTitle || got.Message != tt.wantM {
				t.Fatalf("ValidateHeroInput() = %+v, want {%q %q %q}", got, tt.wantEyebrow, tt.wantTitle, tt.wantM)
			}
		})
	}
}

func TestValidateCarouselSlideInput(t *testing.T) {
	tests := []struct {
		name                             string
		imagePath, alt, caption, linkURL string
		external                         bool
		want                             CarouselSlideInput
		wantErr                          error
	}{
		{
			name: "valid, minimal", imagePath: "/static/img.svg", alt: "Alt text",
			want: CarouselSlideInput{ImagePath: "/static/img.svg", Alt: "Alt text"},
		},
		{
			name: "valid, full", imagePath: " /static/img.svg ", alt: " Alt ", caption: " Cap ", linkURL: " https://x ", external: true,
			want: CarouselSlideInput{ImagePath: "/static/img.svg", Alt: "Alt", Caption: "Cap", LinkURL: "https://x", External: true},
		},
		{name: "missing image path", imagePath: "", alt: "Alt", wantErr: ErrSlideImagePathRequired},
		{name: "missing alt", imagePath: "/static/img.svg", alt: "", wantErr: ErrSlideAltRequired},
		{name: "image outside /static/", imagePath: "/img.svg", alt: "Alt", wantErr: ErrSlideImagePathInvalid},
		{name: "invalid link", imagePath: "/static/img.svg", alt: "Alt", linkURL: "javascript:alert(1)", wantErr: ErrSlideLinkURLInvalid},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ValidateCarouselSlideInput(tt.imagePath, tt.alt, tt.caption, tt.linkURL, tt.external)
			if tt.wantErr != nil {
				if err != tt.wantErr {
					t.Fatalf("ValidateCarouselSlideInput() error = %v, want %v", err, tt.wantErr)
				}
				return
			}
			if err != nil {
				t.Fatalf("ValidateCarouselSlideInput() unexpected error: %v", err)
			}
			if got != tt.want {
				t.Fatalf("ValidateCarouselSlideInput() = %+v, want %+v", got, tt.want)
			}
		})
	}
}

func TestValidateWorkItemInput(t *testing.T) {
	tests := []struct {
		name                                string
		kicker, title, description, liveURL string
		wantErr                             error
	}{
		{name: "valid submission", kicker: "Game", title: "Fishing Game", description: "Desc", liveURL: "/fishing-game"},
		{name: "missing kicker", kicker: "", title: "T", description: "D", liveURL: "/x", wantErr: ErrWorkKickerRequired},
		{name: "missing title", kicker: "Game", title: "", description: "D", liveURL: "/x", wantErr: ErrWorkTitleRequired},
		{name: "missing description", kicker: "Game", title: "T", description: "", liveURL: "/x", wantErr: ErrWorkDescriptionRequired},
		{name: "missing live URL", kicker: "Game", title: "T", description: "D", liveURL: "", wantErr: ErrWorkLiveURLRequired},
		{name: "external live URL", kicker: "Game", title: "T", description: "D", liveURL: "https://github.com/vincentmegia"},
		{name: "protocol-relative live URL", kicker: "Game", title: "T", description: "D", liveURL: "//evil.example", wantErr: ErrWorkLiveURLInvalid},
		{name: "javascript live URL", kicker: "Game", title: "T", description: "D", liveURL: "javascript:alert(1)", wantErr: ErrWorkLiveURLInvalid},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := ValidateWorkItemInput(tt.kicker, tt.title, tt.description, tt.liveURL, false)
			if tt.wantErr != nil {
				if err != tt.wantErr {
					t.Fatalf("ValidateWorkItemInput() error = %v, want %v", err, tt.wantErr)
				}
				return
			}
			if err != nil {
				t.Fatalf("ValidateWorkItemInput() unexpected error: %v", err)
			}
		})
	}
}

func TestValidImagePath(t *testing.T) {
	tests := []struct {
		path string
		want bool
	}{
		{"/static/images/carousel/1.svg", true},
		{"/static/images/busrush/screenshot.png", true},
		{"/static/a.png?v=2", true},
		{"/static/", true},
		{"/img.svg", false},
		{"static/img.svg", false},
		{"/statics/img.svg", false},
		{"//evil.example/static/x.png", false},
		{"/static//evil.example/x.png", false},
		{"/static/../templates/base.html", false},
		{"/static/..%2fx", false},
		{"/static/\\evil.example", false},
		{"/static/a b.png", false},
		{"/static/a\nb.png", false},
		{"https://example.com/static/x.png", false},
		{"data:image/svg+xml,<svg/>", false},
		{"javascript:alert(1)", false},
		{"/static/" + strings.Repeat("a", 2041), false},
	}
	for _, tt := range tests {
		if got := validImagePath(tt.path); got != tt.want {
			t.Errorf("validImagePath(%q) = %v, want %v", tt.path, got, tt.want)
		}
	}
}

func TestValidContentLink(t *testing.T) {
	tests := []struct {
		link string
		want bool
	}{
		{"/projects", true},
		{"/", true},
		{"/fishing-game?x=1#top", true},
		{"https://github.com/vincentmegia", true},
		{"HTTPS://github.com/vincentmegia", true},
		{"https://example.com:8443/a?b=c", true},
		{"//evil.example", false},
		{"/\\evil.example", false},
		{"http://example.com", false},
		{"https://", false},
		{"https:example.com", false},
		{"https://user:pass@example.com", false},
		{"javascript:alert(1)", false},
		{"JavaScript:alert(1)", false},
		{"data:text/html,<script>alert(1)</script>", false},
		{"vbscript:x", false},
		{"mailto:me@example.com", false},
		{"projects", false},
		{"./projects", false},
		{" /projects", false},
		{"/pro jects", false},
		{"/a\tb", false},
		{"https://example.com/" + strings.Repeat("a", 2048), false},
	}
	for _, tt := range tests {
		if got := validContentLink(tt.link); got != tt.want {
			t.Errorf("validContentLink(%q) = %v, want %v", tt.link, got, tt.want)
		}
	}
}

// TestSeededLandingContentIsValid keeps migration 005's seed rows passing
// today's write validation, so editing a seeded row unchanged still saves.
func TestSeededLandingContentIsValid(t *testing.T) {
	for _, s := range []struct{ image, link string }{
		{"/static/images/carousel/1.svg", ""},
		{"/static/images/carousel/2.svg", "/projects"},
		{"/static/images/carousel/4.svg", "https://github.com/vincentmegia"},
	} {
		if _, err := ValidateCarouselSlideInput(s.image, "alt", "", s.link, false); err != nil {
			t.Errorf("seed slide %q/%q: %v", s.image, s.link, err)
		}
	}
	for _, live := range []string{"/fishing-game", "/kitchen-shift", "/puzzle-solver"} {
		if _, err := ValidateWorkItemInput("Game", "T", "D", live, false); err != nil {
			t.Errorf("seed work item %q: %v", live, err)
		}
	}
}
