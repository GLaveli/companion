import { getMemoryDb, initMemoryDb, isMemoryDbInitialized } from './db'
import { ensureQdrantConnection, isQdrantEnabled } from './qdrant'

/** Intervalo mínimo entre tentativas pesadas de reconexão (Qdrant, Whisper, LLM). */
export const RECONNECT_COOLDOWN_MS = 15_000
let lastReconnectAttempt = 0

export function checkSqliteHealth(): boolean {
  if (!isMemoryDbInitialized()) return false
  try {
    getMemoryDb().prepare('SELECT 1').get()
    return true
  } catch {
    return false
  }
}

/** Tenta abrir o diário SQLite se ainda não estiver activo. */
export function ensureSqliteHealth(): boolean {
  if (!isMemoryDbInitialized()) {
    try {
      initMemoryDb()
      return true
    } catch {
      return false
    }
  }
  return checkSqliteHealth()
}

export async function checkMenteHealth(): Promise<boolean> {
  if (isQdrantEnabled()) {
    const ok = await ensureQdrantConnection()
    return ok
  }

  const now = Date.now()
  if (now - lastReconnectAttempt < RECONNECT_COOLDOWN_MS) return false

  lastReconnectAttempt = now
  return ensureQdrantConnection()
}
