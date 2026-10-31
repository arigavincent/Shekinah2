-- +goose Up
ALTER TABLE live_sessions ADD COLUMN transport TEXT NOT NULL DEFAULT 'mediamtx' CHECK(transport IN ('mediamtx','r2'));
ALTER TABLE live_sessions ADD COLUMN segment_format TEXT NOT NULL DEFAULT 'mpegts' CHECK(segment_format IN ('mpegts','fmp4'));
ALTER TABLE live_sessions ADD COLUMN last_segment_at TIMESTAMPTZ;
CREATE TABLE live_segments (
 session_id TEXT NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
 sequence INT NOT NULL CHECK(sequence>=-1 AND sequence<20000),
 object_key TEXT NOT NULL UNIQUE,
 size_bytes BIGINT NOT NULL CHECK(size_bytes>0 AND size_bytes<=8388608),
 sha256 TEXT NOT NULL CHECK(length(sha256)=64),
 duration DOUBLE PRECISION NOT NULL CHECK(duration>=0 AND duration<=30),
 ready BOOLEAN NOT NULL DEFAULT FALSE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY(session_id,sequence)
);
CREATE INDEX live_segments_ready ON live_segments(session_id,sequence) WHERE ready;
-- +goose Down
DROP TABLE live_segments;
ALTER TABLE live_sessions DROP COLUMN last_segment_at, DROP COLUMN segment_format, DROP COLUMN transport;
