-- Hospital Shift Daily Challenge (docs/features/hospital-shift.md's Data
-- Model): one shift seeded by the UTC date, submitted with that date so it
-- ranks on its own board. NULL for an ordinary 30-shift run. The all-time
-- board ranks only NULL rows — a one-shift daily paycheck isn't comparable
-- to a whole month's earnings.

-- +goose Up
ALTER TABLE hospital_scores ADD COLUMN daily_date DATE;

CREATE INDEX idx_hospital_scores_daily ON hospital_scores (daily_date, total_earnings DESC)
    WHERE daily_date IS NOT NULL;

-- +goose Down
DROP INDEX idx_hospital_scores_daily;
ALTER TABLE hospital_scores DROP COLUMN daily_date;
