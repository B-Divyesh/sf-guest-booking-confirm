PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  business_name TEXT NOT NULL,
  service_name TEXT NOT NULL,
  timezone TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  weekly_hours TEXT NOT NULL,
  welcome_note TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  paid_until TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  guest_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  starts_at TEXT NOT NULL,
  timezone TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('requested','awaiting_confirmation','confirmed','reschedule_requested','cancelled','completed')),
  guest_token TEXT NOT NULL,
  guest_token_hash TEXT NOT NULL UNIQUE,
  consent_at TEXT NOT NULL,
  reminder_done INTEGER NOT NULL DEFAULT 0,
  reminder_done_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bookings_starts ON bookings(starts_at);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

CREATE TABLE IF NOT EXISTS owner_sessions (
  token_hash TEXT PRIMARY KEY,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS page_counts (
  day TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0
);
