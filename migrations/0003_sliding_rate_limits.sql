CREATE TABLE IF NOT EXISTS rate_limit_events (
  client_key TEXT NOT NULL,
  occurred_at_ms INTEGER NOT NULL,
  event_id TEXT NOT NULL,
  PRIMARY KEY (client_key, event_id)
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_events_time
  ON rate_limit_events(occurred_at_ms);
