package handler

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/vincentmegia/vincentmegia/internal/middleware"
	"github.com/vincentmegia/vincentmegia/internal/model"
	"github.com/vincentmegia/vincentmegia/internal/service"
)

// hospitalLeaderboardView is the hospital-leaderboard fragment's data: one
// board's top scores, and which board it is — Daily is the Daily
// Challenge's YYYY-MM-DD date, "" for the all-time board.
type hospitalLeaderboardView struct {
	Scores []model.HospitalScore
	Daily  string
}

// hospitalLeaderboardLimit is the top-N size shown on the public
// leaderboard, same value as cookingLeaderboardLimit
// (docs/features/hospital-shift.md's Data Model mirrors cooking_scores).
const hospitalLeaderboardLimit = 20

// HospitalShiftHandler serves /hospital-shift and its two leaderboard routes.
// See docs/features/hospital-shift.md's Routes/Handlers.
type HospitalShiftHandler struct {
	Renderer *Renderer
	Service  *service.HospitalService
	// Version is injected the same way as CookingGameHandler.Version — the
	// footer version is shared shell state, not hospital-game-specific.
	Version string
	// limiter enforces docs/features/hospital-shift.md's Security
	// Considerations: "POST /hospital-shift/score is rate-limited per-IP via
	// a dedicated scoreSubmitLimiter instance (own limit/window, not
	// shared with the other two games' limiters)".
	limiter *scoreSubmitLimiter
	// runLimiter bounds POST /hospital-shift/run (run tickets) per IP.
	runLimiter *scoreSubmitLimiter
}

// NewHospitalShiftHandler constructs a HospitalShiftHandler.
func NewHospitalShiftHandler(renderer *Renderer, hospitalService *service.HospitalService, version string) *HospitalShiftHandler {
	return &HospitalShiftHandler{
		Renderer:   renderer,
		Service:    hospitalService,
		Version:    version,
		limiter:    newScoreSubmitLimiter(hospitalScoreSubmitLimit, hospitalScoreSubmitWindow),
		runLimiter: newScoreSubmitLimiter(hospitalRunStartLimit, hospitalRunStartWindow),
	}
}

// Index handles GET /hospital-shift. There's no database fetch here: every
// player-specific value (Gard, current shift, rank) lives in the page's
// memory for one visit and resets when the player leaves (nothing is saved
// client-side), and the leaderboard itself loads via its own request
// (GET /hospital-shift/leaderboard), not inline — see
// docs/features/hospital-shift.md's Routes/Handlers table.
func (h *HospitalShiftHandler) Index(w http.ResponseWriter, r *http.Request) {
	data := shellPageData(r, h.Version, "Hospital Shift", false)
	data.ContentTemplate = "hospital-shift-content"
	h.Renderer.Render(w, r, data)
}

// Leaderboard handles GET /hospital-shift/leaderboard, returning the
// hospital-leaderboard fragment (innerHTML target, per the HTMX
// Interactions table). Always a bare fragment, never wrapped in the page
// shell. ?board=daily returns today's Daily Challenge board instead.
func (h *HospitalShiftHandler) Leaderboard(w http.ResponseWriter, r *http.Request) {
	daily := ""
	if r.URL.Query().Get("board") == "daily" {
		daily = h.Service.Today()
	}
	h.renderBoard(w, r, daily)
}

// renderBoard renders one board's fragment (daily "" = all-time).
func (h *HospitalShiftHandler) renderBoard(w http.ResponseWriter, r *http.Request, daily string) {
	var scores []model.HospitalScore
	var err error
	if daily == "" {
		scores, err = h.Service.Leaderboard(r.Context(), hospitalLeaderboardLimit)
	} else {
		scores, err = h.Service.DailyLeaderboard(r.Context(), daily, hospitalLeaderboardLimit)
	}
	if err != nil {
		slog.Error("get hospital leaderboard", "daily", daily, "error", err)
		writeHospitalLeaderboardError(w)
		return
	}
	h.Renderer.RenderFragment(w, "hospital-leaderboard", hospitalLeaderboardView{Scores: scores, Daily: daily})
}

// SubmitScore handles POST /hospital-shift/score: validates and inserts a
// leaderboard entry, then returns the refreshed fragment (outerHTML
// target, per the HTMX Interactions table) so a successful submission's
// own row is visible immediately — the daily board for a Daily Challenge
// run (form field daily_date).
//
// Request parsing: standard HTML form encoding
// (application/x-www-form-urlencoded), read via r.ParseForm()/
// r.FormValue — not JSON. Same reasoning as
// CookingGameHandler.SubmitScore's doc comment.
//
// CSRF: covered the same way as FishingGameHandler.SubmitScore — a
// cross-site browser POST is refused by middleware.CrossOriginProtection
// before this runs; see that handler's doc comment.
func (h *HospitalShiftHandler) SubmitScore(w http.ResponseWriter, r *http.Request) {
	if !h.limiter.Allow(middleware.ClientKey(r)) {
		http.Error(w, "Too many submissions — please slow down and try again shortly.", http.StatusTooManyRequests)
		return
	}

	if err := r.ParseForm(); err != nil {
		http.Error(w, "Couldn't read that submission.", http.StatusBadRequest)
		return
	}

	playerName := r.FormValue("player_name")
	totalEarnings, earningsErr := strconv.Atoi(r.FormValue("total_earnings"))
	shiftsCompleted, shiftsErr := strconv.Atoi(r.FormValue("shifts_completed"))
	if earningsErr != nil || shiftsErr != nil {
		http.Error(w, "Total earnings and shifts completed must be whole numbers.", http.StatusBadRequest)
		return
	}

	daily := r.FormValue("daily_date")
	ticket := r.FormValue("run_ticket")
	if err := h.Service.SubmitScore(r.Context(), playerName, totalEarnings, shiftsCompleted, daily, ticket); err != nil {
		if isHospitalValidationError(err) {
			// A curated, user-facing sentinel from
			// service.ValidateHospitalScoreSubmission — safe to surface
			// directly, unlike a raw DB error.
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		// Anything else (e.g. a DB failure) is never shown to the client.
		slog.Error("submit hospital score", "error", err)
		writeHospitalLeaderboardError(w)
		return
	}

	h.renderBoard(w, r, daily)
}

// StartRun handles POST /hospital-shift/run: the page calls it when a run
// (shift 1, or a Daily Challenge) starts and keeps the signed ticket it
// returns for the Final Paycheck's score submission — see
// service.HospitalRunTickets. Plain text, not HTML: it's read by fetch, not
// swapped in by HTMX. The kind form/query value says which run the ticket
// is for — "daily" for a Daily Challenge, "month" (or none) for a month —
// and the ticket only submits a score of that kind.
func (h *HospitalShiftHandler) StartRun(w http.ResponseWriter, r *http.Request) {
	if !h.runLimiter.Allow(middleware.ClientKey(r)) {
		http.Error(w, "Too many runs started — please slow down.", http.StatusTooManyRequests)
		return
	}
	var daily bool
	switch r.FormValue("kind") {
	case "", "month":
	case "daily":
		daily = true
	default:
		http.Error(w, "Unknown run kind.", http.StatusBadRequest)
		return
	}
	ticket, err := h.Service.IssueRunTicket(daily)
	if err != nil {
		slog.Error("issue hospital run ticket", "error", err)
		http.Error(w, "Couldn't start a run.", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.Write([]byte(ticket))
}

// isHospitalValidationError reports whether err is one of
// service.ValidateHospitalScoreSubmission's sentinel errors, as opposed to
// an unexpected/internal failure (e.g. a DB error) that must not be shown
// to the client.
func isHospitalValidationError(err error) bool {
	for _, sentinel := range []error{
		service.ErrHospitalScorePlayerNameRequired,
		service.ErrHospitalScorePlayerNameTooLong,
		service.ErrPlayerNameInvalidCharacters,
		service.ErrHospitalScoreEarningsOutOfRange,
		service.ErrHospitalScoreShiftsOutOfRange,
		service.ErrHospitalDailyDateInvalid,
		service.ErrHospitalDailyDateStale,
		service.ErrHospitalDailyShiftsInvalid,
		service.ErrHospitalMonthShiftsInvalid,
		service.ErrHospitalEarningsImplausible,
		service.ErrHospitalRunTicketMissing,
		service.ErrHospitalRunTicketInvalid,
		service.ErrHospitalRunTicketExpired,
		service.ErrHospitalRunTicketWrongKind,
		service.ErrHospitalRunTicketUsed,
		service.ErrHospitalRunTooFast,
	} {
		if errors.Is(err, sentinel) {
			return true
		}
	}
	return false
}

// writeHospitalLeaderboardError renders the "Leaderboard error" UI state
// (docs/features/hospital-shift.md's UI table): "Leaderboard fetch failure
// renders an inline error state in the fragment, same as
// writeCookingLeaderboardError's pattern." Kept as a small hand-written
// fragment (not a parsed template), matching that exact same reasoning.
func writeHospitalLeaderboardError(w http.ResponseWriter) {
	// 200, not 5xx — see writeCookingLeaderboardError's doc comment for why.
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`<p id="hospital-leaderboard" class="ha-panel ha-muted px-4 py-3 text-sm">Couldn't load the leaderboard.</p>`))
}

// hospitalScoreSubmitLimit/hospitalScoreSubmitWindow bound this feature's own
// scoreSubmitLimiter instance: at most this many POST /hospital-shift/score
// requests per source per window. Same coarse anti-spam values as
// cookingScoreSubmitLimit/cookingScoreSubmitWindow — a dedicated instance,
// not shared with the other games' limiters, per
// docs/features/hospital-shift.md's Security Considerations.
const (
	hospitalScoreSubmitLimit  = 5
	hospitalScoreSubmitWindow = time.Minute
)

// hospitalRunStartLimit/hospitalRunStartWindow bound POST /hospital-shift/run.
// Generous on purpose: a ticket is a cheap HMAC (no database), the real
// protection is the time check and single use, and the Playwright suite
// starts a run for nearly every test from one IP (at 20/min its 429s
// showed up as console errors). It still stops bulk minting.
const (
	hospitalRunStartLimit  = 120
	hospitalRunStartWindow = time.Minute
)
