-- Bus Rush Daily Challenge (docs/features/bus-rush.md's Data Model): a run
-- on the day's seeded road is submitted with that day's UTC date, so it can
-- be ranked on its own board. NULL for ordinary runs. The all-time board
-- still ranks every row.

-- +goose Up
ALTER TABLE bus_rush_scores ADD COLUMN daily_date DATE;

CREATE INDEX idx_bus_rush_scores_daily ON bus_rush_scores (daily_date, score DESC)
    WHERE daily_date IS NOT NULL;

-- +goose Down
DROP INDEX idx_bus_rush_scores_daily;
ALTER TABLE bus_rush_scores DROP COLUMN daily_date;
