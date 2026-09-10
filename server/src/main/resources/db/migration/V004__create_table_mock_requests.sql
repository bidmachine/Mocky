-- Requests captured by a mock that has capture enabled.
--
-- A mock plays back a canned response; when `capture_limit` is greater than zero the runner also
-- records what arrived. Rows are trimmed on insert rather than by a scheduled job, because the
-- application has no scheduler and `expire_at` on mocks_v3 shows what happens to a retention
-- policy nothing enforces.

ALTER TABLE mocks_v3
    ADD COLUMN capture_limit integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN mocks_v3.capture_limit IS
    'How many recent requests to keep for this mock. 0 disables capture.';

CREATE TABLE mock_requests
(
    id UUID NOT NULL DEFAULT uuid_generate_v4 (),

    mock_id UUID NOT NULL,

    method character varying NOT NULL,
    -- Path suffix after /v3/<id>, empty when the mock was called on its bare URL
    path character varying NOT NULL,
    query character varying,
    headers jsonb NOT NULL,

    -- Capped prefix of the body. `body_size` is the real size before truncation, so a
    -- truncated capture still reports how much actually arrived.
    body bytea,
    body_size integer NOT NULL,
    truncated boolean NOT NULL DEFAULT false,
    content_type character varying,

    -- Hashed, matching how mocks_v3 stores the creator's address
    hash_ip character varying NOT NULL,

    received_at timestamp with time zone NOT NULL,

    CONSTRAINT mock_requests_pkey PRIMARY KEY (id),
    CONSTRAINT mock_requests_mock_fkey FOREIGN KEY (mock_id)
        REFERENCES mocks_v3 (id) ON DELETE CASCADE
);

-- The only read pattern: newest-first for one mock. Also serves the trim-on-insert delete.
CREATE INDEX mock_requests_mock_received_idx
    ON mock_requests (mock_id, received_at DESC);
