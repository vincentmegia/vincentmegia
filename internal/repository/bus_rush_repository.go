package repository

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/vincentmegia/vincentmegia/internal/model"
)

// BusRushRepository reads and writes the bus_rush_scores table — Bus
// Rush's public leaderboard. See docs/features/bus-rush.md's Data Model.
// Same DB/ReadDB split as FishingRepository.
type BusRushRepository struct {
	DB     *sql.DB
	ReadDB *sql.DB
}

// NewBusRushRepository wraps two already-open database handles — db for
// writes, readDB for reads.
func NewBusRushRepository(db, readDB *sql.DB) *BusRushRepository {
	return &BusRushRepository{DB: db, ReadDB: readDB}
}

// Insert stores one already-validated leaderboard submission. The table's
// CHECK constraints are a backstop; service.ValidateBusRushScoreSubmission
// is the primary validation layer. dailyDate is the Daily Challenge's day,
// or nil for an ordinary run.
func (repo *BusRushRepository) Insert(ctx context.Context, playerName string, score, distanceMeters int, dailyDate *time.Time) error {
	const query = `
		INSERT INTO bus_rush_scores (player_name, score, distance_meters, daily_date)
		VALUES ($1, $2, $3, $4)`
	if _, err := repo.DB.ExecContext(ctx, query, playerName, score, distanceMeters, dailyDate); err != nil {
		return fmt.Errorf("insert bus_rush_scores: %w", err)
	}
	return nil
}

// TopScores fetches the top `limit` rows by score, descending. Read-only —
// uses ReadDB.
func (repo *BusRushRepository) TopScores(ctx context.Context, limit int) ([]model.BusRushScore, error) {
	const query = `
		SELECT player_name, score, distance_meters, created_at
		FROM bus_rush_scores
		ORDER BY score DESC
		LIMIT $1`

	rows, err := repo.ReadDB.QueryContext(ctx, query, limit)
	if err != nil {
		return nil, fmt.Errorf("query bus_rush_scores: %w", err)
	}
	return scanBusRushScores(rows)
}

// TopDailyScores fetches the top `limit` Daily Challenge rows for one day,
// by score descending. Read-only — uses ReadDB.
func (repo *BusRushRepository) TopDailyScores(ctx context.Context, day time.Time, limit int) ([]model.BusRushScore, error) {
	const query = `
		SELECT player_name, score, distance_meters, created_at
		FROM bus_rush_scores
		WHERE daily_date = $1
		ORDER BY score DESC
		LIMIT $2`

	rows, err := repo.ReadDB.QueryContext(ctx, query, day, limit)
	if err != nil {
		return nil, fmt.Errorf("query daily bus_rush_scores: %w", err)
	}
	return scanBusRushScores(rows)
}

func scanBusRushScores(rows *sql.Rows) ([]model.BusRushScore, error) {
	defer rows.Close()

	var scores []model.BusRushScore
	for rows.Next() {
		var s model.BusRushScore
		if err := rows.Scan(&s.PlayerName, &s.Score, &s.DistanceMeters, &s.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan bus_rush_scores row: %w", err)
		}
		scores = append(scores, s)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate bus_rush_scores: %w", err)
	}
	return scores, nil
}
