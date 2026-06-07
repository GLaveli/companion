import type { MemoryIndicatorState } from '../../../shared/types'
import { getMemoryDb, isMemoryDbInitialized } from './db'
import { ensureQdrantConnection, isQdrantEnabled } from './qdrant'

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
  return ensureQdrantConnection()
}
