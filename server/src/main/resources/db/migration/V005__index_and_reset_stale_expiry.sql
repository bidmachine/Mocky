-- Two things this release needs before `expire_at` is read for the first time.

-- 1. Forgive the backlog.
--
-- `expire_at` has been written since V001 and never read by any SELECT, so a mock whose owner
-- picked "1 week" three years ago has been serving traffic ever since. Enforcing the column now
-- would 404 those mocks on deploy and then hard-delete them, which is not what anyone chose: they
-- chose an expiry under a system that did not have one. Clearing the past values makes them
-- permanent, matching how they have actually behaved. Expiries chosen from here on are honoured.
UPDATE mocks_v3
SET expire_at = NULL
WHERE expire_at IS NOT NULL
  AND expire_at <= NOW();

-- 2. Let the sweep find its rows.
--
-- The sweep runs on every mock creation. Without this it is a sequential scan of the whole table
-- each time; the partial index keeps it off the rows that never expire, which is most of them.
CREATE INDEX IF NOT EXISTS mocks_v3_expire_at_idx
    ON mocks_v3 (expire_at)
    WHERE expire_at IS NOT NULL;

-- 3. Say what `body_size` actually means.
--
-- V004 called it "the real size before truncation". It is not: the body is read only up to the
-- configured read limit, so anything larger reports the limit. `truncated` is what says the
-- stored bytes are shorter than what arrived. Corrected here rather than by editing V004, whose
-- checksum is already recorded wherever it has been applied.
COMMENT ON COLUMN mock_requests.body_size IS
    'Bytes read from the request, capped at the configured read limit; see truncated.';
