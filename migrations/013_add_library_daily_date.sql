-- Library Shift Daily Challenge (docs/features/library-game.md's Data
-- Model): one shift seeded by the UTC date, submitted with that date so it
-- ranks on its own board. NULL for an ordinary 30-shift run. The all-time
-- board ranks only NULL rows — a one-shift daily paycheck isn't comparable
-- to a whole month's earnings. Mirrors 012_add_hospital_daily_date.sql.

-- +goose Up
ALTER TABLE library_scores ADD COLUMN daily_date DATE;

CREATE INDEX idx_library_scores_daily ON library_scores (daily_date, total_earnings DESC)
    WHERE daily_date IS NOT NULL;

-- +goose Down
DROP INDEX idx_library_scores_daily;
ALTER TABLE library_scores DROP COLUMN daily_date;
