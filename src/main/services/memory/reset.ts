import { unlinkSync } from 'node:fs'
import { closeMemoryDb, dbPathForReset, initMemoryDb, isMemoryDbInitialized } from './db'
import { clearQdrantCollection } from './qdrant'

/** Apaga SQLite + Qdrant (persistente). Chame resetTranscript/resetSessionMemory no caller. */
export async function clearAllPersistentMemory(): Promise<{ sqlite: boolean; qdrant: boolean }> {
  let sqlite = false
  if (isMemoryDbInitialized()) {
    closeMemoryDb()
  }

  try {
    for (const suffix of ['', '-wal', '-shm']) {
      try {
        unlinkSync(dbPathForReset() + suffix)
      } catch {
        /* ok if missing */
      }
    }
    initMemoryDb()
    sqlite = true
  } catch (err) {
    console.warn('[memory] SQLite reset failed:', (err as Error).message)
  }

  const qdrant = await clearQdrantCollection()
  return { sqlite, qdrant }
}
