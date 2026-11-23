import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

fs.mkdirSync(config.dataDir, { recursive: true });

export const db = new Database(path.join(config.dataDir, 'llaveble.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS gates (
  id         TEXT PRIMARY KEY,
  last_seen  INTEGER
);

CREATE TABLE IF NOT EXISTS credentials (
  serial       INTEGER PRIMARY KEY AUTOINCREMENT,
  gate_id      TEXT    NOT NULL,
  guest_name   TEXT    NOT NULL,
  valid_from   TEXT    NOT NULL,           -- AAAA-MM-DD (hora local)
  valid_to     TEXT    NOT NULL,           -- AAAA-MM-DD (hora local)
  days         INTEGER NOT NULL,           -- máscara de bits, bit 0 = domingo
  time_from    INTEGER NOT NULL,           -- minutos desde medianoche
  time_to      INTEGER NOT NULL,           -- minutos desde medianoche
  invite_code  TEXT    NOT NULL UNIQUE,
  public_key   TEXT,                       -- llave pública del invitado (base64url, 65 bytes)
  status       TEXT    NOT NULL DEFAULT 'pending',  -- pending | active | revoked
  created_at   INTEGER NOT NULL,
  claimed_at   INTEGER,
  revoked_at   INTEGER
);

CREATE TABLE IF NOT EXISTS revocation_state (
  gate_id  TEXT PRIMARY KEY,
  version  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  gate_id      TEXT    NOT NULL,
  ts           INTEGER NOT NULL,           -- hora del portón (unix)
  serial       INTEGER,
  guest        TEXT,
  code         TEXT    NOT NULL,
  received_at  INTEGER NOT NULL
);
`);

db.prepare('INSERT OR IGNORE INTO gates (id, last_seen) VALUES (?, NULL)').run(config.gateId);
db.prepare('INSERT OR IGNORE INTO revocation_state (gate_id, version) VALUES (?, 1)').run(config.gateId);
