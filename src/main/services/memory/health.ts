import { getMemoryDb, isMemoryDbInitialized } from './db'
import { ensureQdrantConnection, isQdrantEnabled } from './qdrant'

const RECONNECT_COOLDOWN_MS = 60_000
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

export async function checkMenteHealth(): Promise<boolean> {
  if (isQdrantEnabled()) return true

  const now = Date.now()
  if (now - lastReconnectAttempt < RECONNECT_COOLDOWN_MS) return false

  lastReconnectAttempt = now
  return ensureQdrantConnection()
}
