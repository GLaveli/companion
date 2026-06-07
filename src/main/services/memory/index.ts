export { initMemoryDb, closeMemoryDb, getCurrentSessionId } from './db'
export {
  initMemory,
  hydrateRecentTurns,
  persistTurn,
  persistEvent,
  getRecentUserMessages,
  getRecentEvents,
  searchTurns,
  searchRecallTopicHits,
  extractRecallTopic
} from './store'
export {
  isQdrantEnabled,
  initQdrant,
  indexMemoryPoint,
  searchQdrant,
  shutdownQdrant,
  EVENT_ID_OFFSET,
  qdrantUrl
} from './qdrant'
export { checkMenteHealth, checkSqliteHealth, ensureSqliteHealth } from './health'
export { clearAllPersistentMemory } from './reset'
export { initEmbeddings, getVectorSize } from './embeddings'
export type {
  MemoryTurn,
  MemoryEvent,
  MemoryEventKind,
  MemoryRole,
  MemorySearchHit
} from './types'
