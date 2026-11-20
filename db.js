'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const { EVENT_IDS, DEFAULT_EVENT } = require('./events');

const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });

const configuredPath = process.env.RUBIX_DB_PATH;
const databasePath =
  configuredPath === ':memory:'
    ? ':memory:'
    : configuredPath
      ? path.resolve(configuredPath)
      : path.join(dataDir, 'rubix.db');

if (databasePath !== ':memory:') {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
}

const db = new DatabaseSync(databasePath);
const eventList = [...EVENT_IDS].map((id) => `'${id}'`).join(', ');

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;

  CREATE TABLE IF NOT EXISTS people (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    name_norm TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id INTEGER NOT NULL REFERENCES people(id),
    event TEXT NOT NULL DEFAULT '${DEFAULT_EVENT}' CHECK (event IN (${eventList})),
    time_ms INTEGER NOT NULL CHECK (time_ms BETWEEN 1000 AND 3600000),
    solved_at TEXT NOT NULL,
    video_url TEXT,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'under_review')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS entry_witnesses (
    entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    person_id INTEGER NOT NULL REFERENCES people(id),
    position INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (entry_id, person_id)
  );

  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    note TEXT,
    reporter_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (entry_id, reporter_id)
  );

  CREATE INDEX IF NOT EXISTS idx_entries_person ON entries(person_id);
  CREATE INDEX IF NOT EXISTS idx_entries_status ON entries(status);
  CREATE INDEX IF NOT EXISTS idx_entries_time ON entries(time_ms);
  CREATE INDEX IF NOT EXISTS idx_reports_entry ON reports(entry_id);
`);

// Existing databases predate the event column. Add it without touching old rows.
const entryColumns = db.prepare('PRAGMA table_info(entries)').all();
if (!entryColumns.some((column) => column.name === 'event')) {
  db.exec(
    `ALTER TABLE entries ADD COLUMN event TEXT NOT NULL DEFAULT '${DEFAULT_EVENT}' ` +
      `CHECK (event IN (${eventList}))`
  );
}

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_entries_event_time ON entries(event, time_ms);
  CREATE INDEX IF NOT EXISTS idx_entries_event_status ON entries(event, status);
`);

// Rebuild report data created by versions that deduplicated with IP hashes.
// This removes all prior IP-derived report identities and starts with no stored IP data.
const reportColumns = db.prepare('PRAGMA table_info(reports)').all();
if (reportColumns.some((column) => column.name === 'ip_hash')) {
  db.exec(`
    DELETE FROM reports;
    ALTER TABLE reports RENAME TO reports_legacy_ip;
    CREATE TABLE reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
      reason TEXT NOT NULL,
      note TEXT,
      reporter_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (entry_id, reporter_id)
    );
    DROP TABLE reports_legacy_ip;
    UPDATE entries SET status = 'active' WHERE status = 'under_review';
  `);
}

function transaction(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // Ignore rollback errors so the original error is preserved.
    }
    throw error;
  }
}

module.exports = { db, transaction, databasePath };
