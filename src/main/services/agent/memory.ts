import type { AgentAction, AgentToolId } from './types'

export interface AgentMemoryEntry {
  fingerprint: string
  toolId: AgentToolId
  params: Record<string, string>
  completedAt: number
  summary: string
  repeatCount: number
}

const TTL_MS = 45 * 60 * 1000
const MAX_ENTRIES = 40

const memory: AgentMemoryEntry[] = []

function stableParams(params: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(params)
      .map(([k, v]) => [k, v.trim().toLowerCase()])
      .sort(([a], [b]) => a.localeCompare(b))
  )
}

export function actionFingerprint(toolId: AgentToolId, params: Record<string, string>): string {
  return `${toolId}:${JSON.stringify(stableParams(params))}`
}

export function findRecentDuplicate(action: AgentAction): AgentMemoryEntry | null {
  const fp = actionFingerprint(action.toolId, action.params)
  const now = Date.now()

  const hit = memory.find((m) => m.fingerprint === fp && now - m.completedAt < TTL_MS)
  return hit ?? null
}

export function findDuplicateInPlan(actions: AgentAction[]): AgentMemoryEntry | null {
  for (const action of actions) {
    const hit = findRecentDuplicate(action)
    if (hit) return hit
  }
  return null
}

export function recordAgentAction(
  action: AgentAction,
  summary: string
): AgentMemoryEntry {
  const fp = actionFingerprint(action.toolId, action.params)
  const existing = memory.find((m) => m.fingerprint === fp)

  const entry: AgentMemoryEntry = {
    fingerprint: fp,
    toolId: action.toolId,
    params: { ...action.params },
    completedAt: Date.now(),
    summary,
    repeatCount: (existing?.repeatCount ?? 0) + 1
  }

  const without = memory.filter((m) => m.fingerprint !== fp)
  without.unshift(entry)
  memory.length = 0
  memory.push(...without.slice(0, MAX_ENTRIES))

  return entry
}

export function clearAgentMemory(): void {
  memory.length = 0
}
