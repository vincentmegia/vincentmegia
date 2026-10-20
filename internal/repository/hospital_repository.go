package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgconn"

	"github.com/vincentmegia/vincentmegia/internal/model"
)

// ErrHospitalRunNonceUsed is Insert's error when a row with the same run
// ticket nonce already exists (the hospital_scores_run_nonce_key UNIQUE
// constraint, migration 014): the ticket was already redeemed.
var ErrHospitalRunNonceUsed = errors.New("hospital run nonce already used")

// hospitalRunNonceConstraint names migration 014's UNIQUE constraint.
const hospitalRunNonceConstraint = "hospital_scores_run_nonce_key"

// HospitalRepository reads and writes the hospital_scores table — the
// Hospital Shift game's public leaderboard. See
// docs/features/hospital-shift.md's Data Model. Mirrors CookingRepository's
// exact shape (same split, same reasoning).
//
// DB and ReadDB are separate handles, same split as CookingRepository/
// ResumeRepository (docs/features/resume.md's Security Considerations):
// Insert uses DB, TopScores uses ReadDB.
type HospitalRepository struct {
	DB     *sql.DB
	ReadDB *sql.DB
}

// NewHospitalRepository wraps two already-open database handles — db for
// writes, readDB for reads.
func NewHospitalRepository(db, readDB *sql.DB) *HospitalRepository {
	return &HospitalRepository{DB: db, ReadDB: readDB}
}

// Insert stores one already-validated leaderboard submission. Callers
// (internal/service.HospitalService) are responsible for bounds-checking
// playerName/totalEarnings/shiftsCompleted before calling this — the
// table's own CHECK constraints are a backstop, not the primary validation
// layer (docs/features/hospital-shift.md's Security Considerations).
// dailyDate is the Daily Challenge's day, or nil for an ordinary run.
// runNonce is the run ticket's nonce ("" stores NULL); a nonce already in
// the table returns ErrHospitalRunNonceUsed and inserts nothing, which is
// what makes a ticket single-use across restarts and instances.
func (repo *HospitalRepository) Insert(ctx context.Context, playerName string, totalEarnings, shiftsCompleted int, dailyDate *time.Time, runNonce string) error {
	const query = `
		INSERT INTO hospital_scores (player_name, total_earnings, shifts_completed, daily_date, run_nonce)
		VALUES ($1, $2, $3, $4, NULLIF($5, ''))`

	if _, err := repo.DB.ExecContext(ctx, query, playerName, totalEarnings, shiftsCompleted, dailyDate, runNonce); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" && pgErr.ConstraintName == hospitalRunNonceConstraint {
			return ErrHospitalRunNonceUsed
		}
		return fmt.Errorf("insert hospital_scores: %w", err)
	}
	return nil
}

// TopScores fetches the top `limit` ordinary runs by total_earnings,
// descending. Daily Challenge rows are left out: a one-shift paycheck
// isn't comparable to a month's earnings (they have their own board, see
// TopDailyScores). Read-only — uses ReadDB.
func (repo *HospitalRepository) TopScores(ctx context.Context, limit int) ([]model.HospitalScore, error) {
	const query = `
		SELECT player_name, total_earnings, shifts_completed, created_at
		FROM hospital_scores
		WHERE daily_date IS NULL
		ORDER BY total_earnings DESC
		LIMIT $1`

	rows, err := repo.ReadDB.QueryContext(ctx, query, limit)
	if err != nil {
		return nil, fmt.Errorf("query hospital_scores: %w", err)
	}
	return scanHospitalScores(rows)
}

// TopDailyScores fetches the top `limit` Daily Challenge rows for one day,
// by total_earnings descending (idx_hospital_scores_daily). Read-only —
// uses ReadDB.
func (repo *HospitalRepository) TopDailyScores(ctx context.Context, day time.Time, limit int) ([]model.HospitalScore, error) {
	const query = `
		SELECT player_name, total_earnings, shifts_completed, created_at
		FROM hospital_scores
		WHERE daily_date = $1
		ORDER BY total_earnings DESC
		LIMIT $2`

	rows, err := repo.ReadDB.QueryContext(ctx, query, day, limit)
	if err != nil {
		return nil, fmt.Errorf("query daily hospital_scores: %w", err)
	}
	return scanHospitalScores(rows)
}

func scanHospitalScores(rows *sql.Rows) ([]model.HospitalScore, error) {
	defer rows.Close()

	var scores []model.HospitalScore
	for rows.Next() {
		var s model.HospitalScore
		if err := rows.Scan(&s.PlayerName, &s.TotalEarnings, &s.ShiftsCompleted, &s.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan hospital_scores row: %w", err)
		}
		scores = append(scores, s)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate hospital_scores: %w", err)
	}

	return scores, nil
}
