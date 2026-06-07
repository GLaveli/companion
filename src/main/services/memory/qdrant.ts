/**
 * Memória semântica da Lotus — Qdrant + embeddings locais (fastembed).
 * Requer Qdrant rodando (docker compose -f docker/qdrant-compose.yml up -d).
 */

import { QdrantClient } from '@qdrant/js-client-rest'
import { devLog } from '../devLog'
import { embedPassage, embedQuery, getVectorSize, initEmbeddings } from './embeddings'
import type { MemoryRole } from './types'

export interface VectorMemoryPoint {
  id: number
  role: MemoryRole
  content: string
  at: number
  sessionId: string
  kind: 'turn' | 'event'
}

const COLLECTION = 'lotus_memory'
const DEFAULT_URL = 'http://127.0.0.1:6333'
/** Event point ids never collide with turn autoincrement ids. */
export const EVENT_ID_OFFSET = 1_000_000_000

let client: QdrantClient | null = null
let ready = false

export function qdrantUrl(): string {
  return process.env.LOTUS_QDRANT_URL?.trim() || DEFAULT_URL
}

export function isQdrantEnabled(): boolean {
  return ready
}

async function ensureCollection(): Promise<void> {
  if (!client) return

  const size = getVectorSize()
  const { collections } = await client.getCollections()
  const exists = collections.some((c) => c.name === COLLECTION)

  if (!exists) {
    await client.createCollection(COLLECTION, {
      vectors: { size, distance: 'Cosine' }
    })
    return
  }

  const info = await client.getCollection(COLLECTION)
  const currentSize = info.config.params.vectors?.size
  if (currentSize !== size) {
    devLog('memory', 'Qdrant recriando collection', `${currentSize}→${size}d`)
    await client.deleteCollection(COLLECTION)
    await client.createCollection(COLLECTION, {
      vectors: { size, distance: 'Cosine' }
    })
  }
}

export async function pingQdrant(): Promise<boolean> {
  if (!client) return false
  try {
    await client.getCollections()
    return true
  } catch {
    return false
  }
}

/** Tenta reconectar ao mind1 sem bloquear o chat. */
export async function ensureQdrantConnection(): Promise<boolean> {
  if (ready && client && (await pingQdrant())) return true
  return initQdrant()
}

export async function initQdrant(): Promise<boolean> {
  const url = qdrantUrl()
  devLog('memory', 'Qdrant conectando', url)
  client = new QdrantClient({ url })

  try {
    await client.getCollections()
  } catch (err) {
    devLog('memory', 'Qdrant offline — recall semântico desativado', (err as Error).message)
    client = null
    ready = false
    return false
  }

  if (!(await initEmbeddings())) {
    devLog('memory', 'Qdrant sem embeddings — recall semântico desativado')
    client = null
    ready = false
    return false
  }

  try {
    await ensureCollection()
    ready = true
    devLog('memory', 'Qdrant pronto', `${url} · ${getVectorSize()}d`)
    return true
  } catch (err) {
    devLog('memory', 'Qdrant init falhou', (err as Error).message)
    client = null
    ready = false
    return false
  }
}

/** Indexa texto com embedding — fire-and-forget, não bloqueia o chat. */
export async function indexMemoryPoint(point: VectorMemoryPoint): Promise<void> {
  if (!client || !ready) return

  const vector = await embedPassage(point.content)
  if (!vector) return

  try {
    await client.upsert(COLLECTION, {
      wait: false,
      points: [
        {
          id: point.id,
          vector,
          payload: {
            role: point.role,
            content: point.content,
            at: point.at,
            sessionId: point.sessionId,
            kind: point.kind
          }
        }
      ]
    })
  } catch (err) {
    console.warn('[memory/qdrant] index failed:', (err as Error).message)
  }
}

export async function searchQdrant(query: string, limit = 6): Promise<VectorMemoryPoint[]> {
  if (!client || !ready) return []

  const vector = await embedQuery(query)
  if (!vector) return []

  try {
    const results = await client.search(COLLECTION, {
      vector,
      limit,
      with_payload: true
    })

    return results
      .map((hit) => {
        const payload = hit.payload as Record<string, unknown> | null | undefined
        if (!payload?.content || !payload.at || !payload.sessionId) return null
        return {
          id: hit.id as number,
          role: payload.role as MemoryRole,
          content: String(payload.content),
          at: Number(payload.at),
          sessionId: String(payload.sessionId),
          kind: (payload.kind as 'turn' | 'event') ?? 'turn'
        }
      })
      .filter((p): p is VectorMemoryPoint => p !== null)
  } catch (err) {
    console.warn('[memory/qdrant] search failed:', (err as Error).message)
    return []
  }
}

export function shutdownQdrant(): void {
  client = null
  ready = false
}

/** Apaga a collection lotus_memory e recria vazia. */
export async function clearQdrantCollection(): Promise<boolean> {
  if (!client) {
    client = new QdrantClient({ url: qdrantUrl() })
  }

  try {
    await client.getCollections()
  } catch {
    client = null
    ready = false
    return false
  }

  try {
    await client.deleteCollection(COLLECTION)
  } catch {
    /* collection may not exist */
  }

  if (!(await initEmbeddings())) {
    client = null
    ready = false
    return false
  }

  try {
    await ensureCollection()
    ready = true
    devLog('memory', 'Qdrant zerado', COLLECTION)
    return true
  } catch (err) {
    devLog('memory', 'Qdrant clear falhou', (err as Error).message)
    client = null
    ready = false
    return false
  }
}
