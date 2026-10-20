package service

import (
	"errors"
	"net/url"
	"strings"
)

// maxCarouselSlides mirrors docs/features/landing-carousel.md's existing
// cap ("up to 5 slides") — content authoring must not let the owner
// exceed it.
const maxCarouselSlides = 5

// ErrSlideNotFound/ErrWorkItemNotFound are what the API-shaped service
// methods return for an unknown ID, so the JSON handler can answer 404
// without importing database/sql or knowing the repository's
// sql.ErrNoRows convention (docs/features/landing-content-api.md).
var (
	ErrSlideNotFound    = errors.New("carousel slide not found")
	ErrWorkItemNotFound = errors.New("selected work item not found")
)

// ErrReorderInvalid is returned when a reorder request's ID list is not
// exactly the set of IDs currently stored — the service's own wrapper
// around repository.ErrReorderIDMismatch, kept in this package so handlers
// depend only on service (docs/skills/go-backend/SKILL.md's layering).
var ErrReorderInvalid = errors.New("reorder list must contain every existing id exactly once")

var (
	ErrHeroEyebrowRequired = errors.New("eyebrow is required")
	ErrHeroTitleRequired   = errors.New("title is required")
	ErrHeroMessageRequired = errors.New("message is required")

	ErrSlideImagePathRequired = errors.New("image path is required")
	ErrSlideAltRequired       = errors.New("alt text is required")
	ErrCarouselFull           = errors.New("the carousel is limited to 5 slides")

	ErrWorkKickerRequired      = errors.New("kicker is required")
	ErrWorkTitleRequired       = errors.New("title is required")
	ErrWorkDescriptionRequired = errors.New("description is required")
	ErrWorkLiveURLRequired     = errors.New("live URL is required")

	ErrSlideImagePathInvalid = errors.New("image path must be a site path under /static/, like /static/images/carousel/1.svg")
	ErrSlideLinkURLInvalid   = errors.New("link URL must be an https:// URL or a site path starting with a single /")
	ErrWorkLiveURLInvalid    = errors.New("live URL must be an https:// URL or a site path starting with a single /")
)

// maxContentURLLen caps ImagePath/LinkURL/LiveURL — far above any real
// path or link, small enough that a row can't carry a payload.
const maxContentURLLen = 2048

// hasUnsafeURLChars reports a backslash (browsers read it as "/", so
// "/\evil.example" is protocol-relative), whitespace or a control
// character anywhere in s.
func hasUnsafeURLChars(s string) bool {
	for _, r := range s {
		if r == '\\' || r <= ' ' || r == 0x7f {
			return true
		}
	}
	return false
}

// validImagePath accepts only a same-origin path under /static/: no scheme
// or host, no protocol-relative "//", no ".." segments.
func validImagePath(p string) bool {
	return len(p) <= maxContentURLLen &&
		strings.HasPrefix(p, "/static/") &&
		!strings.Contains(p, "//") &&
		!strings.Contains(p, "..") &&
		!hasUnsafeURLChars(p)
}

// validContentLink accepts an absolute https:// URL with a host, or a
// root-relative path with a single leading slash ("/projects", not
// "//evil.example"). Everything else — javascript:, data:, http:, other
// schemes, relative paths — is rejected, so a stored link can only ever
// lead to this site or an HTTPS page.
func validContentLink(link string) bool {
	if len(link) > maxContentURLLen || hasUnsafeURLChars(link) {
		return false
	}
	if strings.HasPrefix(link, "/") {
		return !strings.HasPrefix(link, "//")
	}
	u, err := url.Parse(link)
	return err == nil && u.Scheme == "https" && u.Host != "" && u.User == nil
}

// HeroInput is a trimmed, validated landing_hero submission.
type HeroInput struct {
	Eyebrow string
	Title   string
	Message string
}

// ValidateHeroInput trims and validates a hero-form submission
// (POST /settings/content/hero). All three fields are required, per
// docs/features/landing-content-authoring.md's Business Rules.
func ValidateHeroInput(eyebrow, title, message string) (HeroInput, error) {
	in := HeroInput{
		Eyebrow: strings.TrimSpace(eyebrow),
		Title:   strings.TrimSpace(title),
		Message: strings.TrimSpace(message),
	}
	if in.Eyebrow == "" {
		return HeroInput{}, ErrHeroEyebrowRequired
	}
	if in.Title == "" {
		return HeroInput{}, ErrHeroTitleRequired
	}
	if in.Message == "" {
		return HeroInput{}, ErrHeroMessageRequired
	}
	return in, nil
}

// CarouselSlideInput is a trimmed, validated carousel-slide submission.
type CarouselSlideInput struct {
	ImagePath string
	Alt       string
	Caption   string
	LinkURL   string
	External  bool
}

// ValidateCarouselSlideInput trims and validates a carousel-slide
// submission (POST/PUT /settings/content/carousel[/{id}]). ImagePath and
// Alt are required; Caption and LinkURL stay optional — mirrors
// model.CarouselSlide's existing shape. ImagePath must be a /static/ path
// and a non-empty LinkURL an https:// URL or single-slash site path
// (validImagePath/validContentLink).
func ValidateCarouselSlideInput(imagePath, alt, caption, linkURL string, external bool) (CarouselSlideInput, error) {
	in := CarouselSlideInput{
		ImagePath: strings.TrimSpace(imagePath),
		Alt:       strings.TrimSpace(alt),
		Caption:   strings.TrimSpace(caption),
		LinkURL:   strings.TrimSpace(linkURL),
		External:  external,
	}
	if in.ImagePath == "" {
		return CarouselSlideInput{}, ErrSlideImagePathRequired
	}
	if !validImagePath(in.ImagePath) {
		return CarouselSlideInput{}, ErrSlideImagePathInvalid
	}
	if in.Alt == "" {
		return CarouselSlideInput{}, ErrSlideAltRequired
	}
	if in.LinkURL != "" && !validContentLink(in.LinkURL) {
		return CarouselSlideInput{}, ErrSlideLinkURLInvalid
	}
	return in, nil
}

// WorkItemInput is a trimmed, validated Selected-work-card submission.
type WorkItemInput struct {
	Kicker      string
	Title       string
	Description string
	LiveURL     string
	External    bool
}

// ValidateWorkItemInput trims and validates a Selected-work-card
// submission (POST/PUT /settings/content/selected-work[/{id}]). Kicker,
// Title, Description, and LiveURL are all required, and LiveURL must be an
// https:// URL or single-slash site path (validContentLink).
func ValidateWorkItemInput(kicker, title, description, liveURL string, external bool) (WorkItemInput, error) {
	in := WorkItemInput{
		Kicker:      strings.TrimSpace(kicker),
		Title:       strings.TrimSpace(title),
		Description: strings.TrimSpace(description),
		LiveURL:     strings.TrimSpace(liveURL),
		External:    external,
	}
	if in.Kicker == "" {
		return WorkItemInput{}, ErrWorkKickerRequired
	}
	if in.Title == "" {
		return WorkItemInput{}, ErrWorkTitleRequired
	}
	if in.Description == "" {
		return WorkItemInput{}, ErrWorkDescriptionRequired
	}
	if in.LiveURL == "" {
		return WorkItemInput{}, ErrWorkLiveURLRequired
	}
	if !validContentLink(in.LiveURL) {
		return WorkItemInput{}, ErrWorkLiveURLInvalid
	}
	return in, nil
}
