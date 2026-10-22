-- Raises the Library Shift and Kitchen Shift leaderboards' total_earnings
-- ceiling to 200,000 Gard, so an honest strong month is no longer refused
-- at submit. The arithmetic is in docs/features/library-game.md's and
-- docs/features/cooking-game.md's Data Model; in short:
--
--   * library_scores (was 100,000): 30 clean shifts pay 30 × 4,000 =
--     120,000 before bonuses, already over the old cap. The month's 320
--     returned books, 174 fines, Karen and Coin Hunt add ~17,000 on
--     average; with every bonus at its theoretical maximum the month
--     comes to ~168,800.
--   * cooking_scores (was 150,000, migration 004): the same 120,000 base,
--     plus counter payments (50 per served customer) averaging ~36,900
--     over a fully served month, Karen's 350 and perfect-pour tips, which
--     puts a strong no-shopping month around 158,000.
--
-- Both stay coarse sanity bounds (Security Considerations), not
-- re-derived formulas. Mirrors service.libraryScoreEarningsMax and
-- service.cookingScoreEarningsMax.

-- +goose Up
ALTER TABLE library_scores DROP CONSTRAINT library_scores_earnings_range;
ALTER TABLE library_scores ADD CONSTRAINT library_scores_earnings_range CHECK (total_earnings BETWEEN 0 AND 200000);

ALTER TABLE cooking_scores DROP CONSTRAINT cooking_scores_earnings_range;
ALTER TABLE cooking_scores ADD CONSTRAINT cooking_scores_earnings_range CHECK (total_earnings BETWEEN 0 AND 200000);

-- +goose Down
-- NOT VALID: rows accepted under the higher cap would otherwise make the
-- rollback fail; the old bound still applies to every new insert.
ALTER TABLE cooking_scores DROP CONSTRAINT cooking_scores_earnings_range;
ALTER TABLE cooking_scores ADD CONSTRAINT cooking_scores_earnings_range CHECK (total_earnings BETWEEN 0 AND 150000) NOT VALID;

ALTER TABLE library_scores DROP CONSTRAINT library_scores_earnings_range;
ALTER TABLE library_scores ADD CONSTRAINT library_scores_earnings_range CHECK (total_earnings BETWEEN 0 AND 100000) NOT VALID;
