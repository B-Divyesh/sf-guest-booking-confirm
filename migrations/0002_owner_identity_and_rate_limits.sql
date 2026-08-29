ALTER TABLE settings ADD COLUMN owner_oid TEXT;
ALTER TABLE settings DROP COLUMN password_hash;
DROP TABLE owner_sessions;

CREATE UNIQUE INDEX IF NOT EXISTS idx_settings_owner_oid
  ON settings(owner_oid)
  WHERE owner_oid IS NOT NULL;

CREATE TABLE IF NOT EXISTS rate_limits (
  client_key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);
