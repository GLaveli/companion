import { interruptAll, isActiveSession } from '../audio/speechSession'
import { useAgentStore } from '../agent/agentStore'

/** Start a new user turn — stops speech and cancels stale async work. */
export function beginUserTurn(): number {
  useAgentStore.getState().clear()
  return interruptAll()
}

export function isCurrentTurn(turn: number): boolean {
  return isActiveSession(turn)
}
