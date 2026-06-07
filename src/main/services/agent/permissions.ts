import type { AgentAction } from './types'

/** browserSearch only opens the default browser — safe to skip the modal. */
export function actionRequiresConfirmation(action: AgentAction): boolean {
  return action.toolId !== 'browserSearch'
}

export function planRequiresConfirmation(actions: AgentAction[]): boolean {
  return actions.some((action) => actionRequiresConfirmation(action))
}

export function validateAction(action: AgentAction): void {
  if (!action.id?.trim()) throw new Error('Ação sem id')
  if (!action.toolId) throw new Error('Ação sem ferramenta')
  if (!action.label?.trim()) throw new Error('Ação sem descrição')
}
