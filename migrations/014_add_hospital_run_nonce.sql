-- Hospital Shift run tickets are single-use (docs/features/hospital-shift.md's
-- Security Considerations): each score row stores the nonce of the run
-- ticket it was submitted with, and the UNIQUE constraint makes a second
-- insert with the same nonce fail — durable across restarts and shared by
-- every server instance, unlike the in-memory set it replaces. NULL for
-- rows submitted before tickets were stored (UNIQUE allows many NULLs).

-- +goose Up
ALTER TABLE hospital_scores ADD COLUMN run_nonce TEXT;

ALTER TABLE hospital_scores ADD CONSTRAINT hospital_scores_run_nonce_key UNIQUE (run_nonce);

-- +goose Down
ALTER TABLE hospital_scores DROP CONSTRAINT hospital_scores_run_nonce_key;
ALTER TABLE hospital_scores DROP COLUMN run_nonce;
