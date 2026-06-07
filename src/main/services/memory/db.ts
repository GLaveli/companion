import { app } from 'electron'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'

let db: DatabaseSync | null = null
let sessionId: string | null = null

function dbPath(): string {
  const dir = join(app.getPath('userData'), 'memory')
  mkdirSync(dir, { recursive: true })
  return join(dir, 'lotus.db')
}

function runMigrations(database: DatabaseSync): void {
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      started_at INTEGER NOT NULL,
      last_active_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS turns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      at INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );

    CREATE INDEX IF NOT EXISTS idx_turns_session_at ON turns(session_id, at DESC);
    CREATE INDEX IF NOT EXISTS idx_turns_at ON turns(at DESC);
    CREATE INDEX IF NOT EXISTS idx_turns_role_at ON turns(role, at DESC);

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      payload TEXT NOT NULL,
      at INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );

    CREATE INDEX IF NOT EXISTS idx_events_kind_at ON events(kind, at DESC);

    CREATE VIRTUAL TABLE IF NOT EXISTS turns_fts USING fts5(
      content,
      content='turns',
      content_rowid='id',
      tokenize='unicode61 remove_diacritics 2'
    );

    CREATE TRIGGER IF NOT EXISTS turns_ai AFTER INSERT ON turns BEGIN
      INSERT INTO turns_fts(rowid, content) VALUES (new.id, new.content);
    END;

    CREATE TRIGGER IF NOT EXISTS turns_ad AFTER DELETE ON turns BEGIN
      INSERT INTO turns_fts(turns_fts, rowid, content) VALUES ('delete', old.id, old.content);
    END;

    CREATE TRIGGER IF NOT EXISTS turns_au AFTER UPDATE ON turns BEGIN
      INSERT INTO turns_fts(turns_fts, rowid, content) VALUES ('delete', old.id, old.content);
      INSERT INTO turns_fts(rowid, content) VALUES (new.id, new.content);
    END;
  `)
}

export function initMemoryDb(): string {
  if (db && sessionId) return sessionId

  db = new DatabaseSync(dbPath())
  runMigrations(db)

  const now = Date.now()
  sessionId = randomUUID()
  db.prepare('INSERT INTO sessions (id, started_at, last_active_at) VALUES (?, ?, ?)').run(
    sessionId,
    now,
    now
  )

  return sessionId
}

export function getMemoryDb(): DatabaseSync {
  if (!db) throw new Error('Memory DB not initialized — call initMemoryDb() first')
  return db
}

export function isMemoryDbInitialized(): boolean {
  return db !== null
}

export function getCurrentSessionId(): string {
  if (!sessionId) throw new Error('Memory session not initialized')
  return sessionId
}

export function touchSession(): void {
  if (!db || !sessionId) return
  db.prepare('UPDATE sessions SET last_active_at = ? WHERE id = ?').run(Date.now(), sessionId)
}

export function closeMemoryDb(): void {
  db?.close()
  db = null
  sessionId = null
}
