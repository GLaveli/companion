export type MemoryRole = 'user' | 'assistant'

export type MemoryEventKind = 'browser_search' | 'agent_action'

export interface MemoryTurn {
  id: number
  sessionId: string
  role: MemoryRole
  content: string
  at: number
}

export interface MemoryEvent {
  id: number
  sessionId: string
  kind: MemoryEventKind
  payload: Record<string, string>
  at: number
}

export interface MemorySearchHit {
  content: string
  role: MemoryRole
  at: number
  score?: number
}
