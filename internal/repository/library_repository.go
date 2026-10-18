package repository

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/vincentmegia/vincentmegia/internal/model"
)

// LibraryRepository reads and writes the library_scores table — the
// Library Shift game's public leaderboard. See
// docs/features/library-game.md's Data Model. Mirrors CookingRepository's
// exact shape (same split, same reasoning).
//
// DB and ReadDB are separate handles, same split as CookingRepository/
// ResumeRepository (docs/features/resume.md's Security Considerations):
// Insert uses DB, TopScores uses ReadDB.
type LibraryRepository struct {
	DB     *sql.DB
	ReadDB *sql.DB
}

// NewLibraryRepository wraps two already-open database handles — db for
// writes, readDB for reads.
func NewLibraryRepository(db, readDB *sql.DB) *LibraryRepository {
	return &LibraryRepository{DB: db, ReadDB: readDB}
}

// Insert stores one already-validated leaderboard submission. Callers
// (internal/service.LibraryService) are responsible for bounds-checking
// playerName/totalEarnings/shiftsCompleted before calling this — the
// table's own CHECK constraints are a backstop, not the primary validation
// layer (docs/features/library-game.md's Security Considerations).
// dailyDate is the Daily Challenge's day, or nil for an ordinary run.
func (repo *LibraryRepository) Insert(ctx context.Context, playerName string, totalEarnings, shiftsCompleted int, dailyDate *time.Time) error {
	const query = `
		INSERT INTO library_scores (player_name, total_earnings, shifts_completed, daily_date)
		VALUES ($1, $2, $3, $4)`

	if _, err := repo.DB.ExecContext(ctx, query, playerName, totalEarnings, shiftsCompleted, dailyDate); err != nil {
		return fmt.Errorf("insert library_scores: %w", err)
	}
	return nil
}

// TopScores fetches the top `limit` rows by total_earnings, descending —
// the same ordering idx_library_scores_earnings exists to serve. Daily
// Challenge rows are left out: a one-shift paycheck isn't comparable to a
// month's (they rank on TopDailyScores). Read-only — uses ReadDB.
func (repo *LibraryRepository) TopScores(ctx context.Context, limit int) ([]model.LibraryScore, error) {
	const query = `
		SELECT player_name, total_earnings, shifts_completed, created_at
		FROM library_scores
		WHERE daily_date IS NULL
		ORDER BY total_earnings DESC
		LIMIT $1`

	rows, err := repo.ReadDB.QueryContext(ctx, query, limit)
	if err != nil {
		return nil, fmt.Errorf("query library_scores: %w", err)
	}
	return scanLibraryScores(rows)
}

// TopDailyScores fetches the top `limit` Daily Challenge rows for one day,
// by total_earnings descending (idx_library_scores_daily). Read-only —
// uses ReadDB.
func (repo *LibraryRepository) TopDailyScores(ctx context.Context, day time.Time, limit int) ([]model.LibraryScore, error) {
	const query = `
		SELECT player_name, total_earnings, shifts_completed, created_at
		FROM library_scores
		WHERE daily_date = $1
		ORDER BY total_earnings DESC
		LIMIT $2`

	rows, err := repo.ReadDB.QueryContext(ctx, query, day, limit)
	if err != nil {
		return nil, fmt.Errorf("query daily library_scores: %w", err)
	}
	return scanLibraryScores(rows)
}

func scanLibraryScores(rows *sql.Rows) ([]model.LibraryScore, error) {
	defer rows.Close()

	var scores []model.LibraryScore
	for rows.Next() {
		var s model.LibraryScore
		if err := rows.Scan(&s.PlayerName, &s.TotalEarnings, &s.ShiftsCompleted, &s.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan library_scores row: %w", err)
		}
		scores = append(scores, s)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate library_scores: %w", err)
	}

	return scores, nil
}
