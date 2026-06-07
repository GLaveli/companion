import { getCurrentSessionId, getMemoryDb, initMemoryDb, touchSession } from './db'
import type {
  MemoryEvent,
  MemoryEventKind,
  MemoryRole,
  MemorySearchHit,
  MemoryTurn
} from './types'

const MAX_HYDRATE_TURNS = 48

export function initMemory(): MemoryTurn[] {
  initMemoryDb()
  return hydrateRecentTurns(MAX_HYDRATE_TURNS)
}

function rowToTurn(row: Record<string, unknown>): MemoryTurn {
  return {
    id: row.id as number,
    sessionId: row.session_id as string,
    role: row.role as MemoryRole,
    content: row.content as string,
    at: row.at as number
  }
}

export function hydrateRecentTurns(limit = MAX_HYDRATE_TURNS): MemoryTurn[] {
  const database = getMemoryDb()
  const rows = database
    .prepare(
      `SELECT id, session_id, role, content, at
       FROM turns
       ORDER BY at DESC
       LIMIT ?`
    )
    .all(limit) as Record<string, unknown>[]

  return rows.reverse().map(rowToTurn)
}

export function persistTurn(role: MemoryRole, content: string): MemoryTurn {
  const trimmed = content.trim()
  if (!trimmed) throw new Error('Empty turn content')

  const database = getMemoryDb()
  const session = getCurrentSessionId()
  const at = Date.now()

  const result = database
    .prepare('INSERT INTO turns (session_id, role, content, at) VALUES (?, ?, ?, ?)')
    .run(session, role, trimmed, at)

  touchSession()

  return {
    id: Number(result.lastInsertRowid),
    sessionId: session,
    role,
    content: trimmed,
    at
  }
}

export function persistEvent(kind: MemoryEventKind, payload: Record<string, string>): MemoryEvent {
  const database = getMemoryDb()
  const session = getCurrentSessionId()
  const at = Date.now()
  const payloadJson = JSON.stringify(payload)

  const result = database
    .prepare('INSERT INTO events (session_id, kind, payload, at) VALUES (?, ?, ?, ?)')
    .run(session, kind, payloadJson, at)

  touchSession()

  return {
    id: Number(result.lastInsertRowid),
    sessionId: session,
    kind,
    payload,
    at
  }
}

export function getRecentUserMessages(limit = 10, excludeContent?: string): MemoryTurn[] {
  const database = getMemoryDb()
  const rows = database
    .prepare(
      `SELECT id, session_id, role, content, at
       FROM turns
       WHERE role = 'user'
       ORDER BY at DESC
       LIMIT ?`
    )
    .all(limit + 5) as Record<string, unknown>[]

  const turns = rows.map(rowToTurn)
  if (!excludeContent) return turns.slice(0, limit)

  const exclude = excludeContent.trim()
  return turns.filter((t) => t.content !== exclude).slice(0, limit)
}

export function getRecentEvents(kind: MemoryEventKind, limit = 5): MemoryEvent[] {
  const database = getMemoryDb()
  const rows = database
    .prepare(
      `SELECT id, session_id, kind, payload, at
       FROM events
       WHERE kind = ?
       ORDER BY at DESC
       LIMIT ?`
    )
    .all(kind, limit) as Record<string, unknown>[]

  return rows.map((row) => ({
    id: row.id as number,
    sessionId: row.session_id as string,
    kind: row.kind as MemoryEventKind,
    payload: JSON.parse(row.payload as string) as Record<string, string>,
    at: row.at as number
  }))
}

/** Keyword search across all stored turns (FTS5). */
export function searchTurns(query: string, limit = 8): MemorySearchHit[] {
  const terms = query
    .trim()
    .split(/\s+/)
    .filter((t) => t.length >= 2)
    .map((t) => t.replace(/[^\p{L}\p{N}]+/gu, ''))
    .filter(Boolean)

  if (!terms.length) return []

  const ftsQuery = terms.map((t) => `"${t.replace(/"/g, '""')}"`).join(' OR ')
  const database = getMemoryDb()

  try {
    const rows = database
      .prepare(
        `SELECT t.content, t.role, t.at, bm25(turns_fts) AS score
         FROM turns_fts
         JOIN turns t ON t.id = turns_fts.rowid
         WHERE turns_fts MATCH ?
         ORDER BY score
         LIMIT ?`
      )
      .all(ftsQuery, limit) as Record<string, unknown>[]

    return rows.map((row) => ({
      content: row.content as string,
      role: row.role as MemoryRole,
      at: row.at as number,
      score: row.score as number
    }))
  } catch {
    return []
  }
}

export function extractRecallTopic(text: string): string | null {
  const t = text.trim()
  const patterns = [
    /(?:falamos|falava|conversamos|conversava|falando|conversando)\s+(?:sobre|de)\s+(.+)/i,
    /(?:do que|sobre o que|sobre o quê)\s+(?:a gente |nós |nos )?(?:fal|convers)(?:amos|ávamos|avamos)?(?:\s+sobre)?\s*(.+)/i,
    /(?:lembra|lembrar)\s+(?:do|da|de|que)\s+(.+)/i
  ]

  for (const pattern of patterns) {
    const match = t.match(pattern)
    if (match?.[1]) {
      const topic = match[1]
        .replace(/\?+$/, '')
        .replace(/\b(agora|hoje|ontem|última|ultima|nossa conversa)\b/gi, '')
        .trim()
      if (topic.length >= 2) return topic
    }
  }

  return null
}
