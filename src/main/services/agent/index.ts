import type {
  AgentAction,
  AgentExecuteResult,
  AgentPlan,
  AgentToolId,
  AgentToolInfo
} from './types'
import { buildIronicReply } from './ironic'
import { findDuplicateInPlan, recordAgentAction } from './memory'
import { persistEvent, EVENT_ID_OFFSET, getCurrentSessionId } from '../memory'
import { indexMemoryPoint } from '../memory/qdrant'
import { enqueueMemoryWrite } from '../memory/writeQueue'
import { planAgent } from './llmPlanner'
import { validateAction } from './permissions'
import { getAgentTool, listAgentToolDefinitions } from './tools'

export type { AgentAction, AgentExecuteResult, AgentPlan, AgentToolId, AgentToolInfo } from './types'

export async function agentPlan(userText: string): Promise<AgentPlan> {
  const plan = await planAgent(userText)

  if (!plan.needsAgent || plan.duplicateMessage) {
    return plan
  }

  const actions = plan.actions ?? []
  if (!actions.length) {
    return { needsAgent: false }
  }

  const duplicate = findDuplicateInPlan(actions)
  if (duplicate) {
    duplicate.repeatCount += 1
    return {
      needsAgent: true,
      duplicateMessage: buildIronicReply(duplicate),
      actions: []
    }
  }

  return plan
}

export function listAgentTools(): AgentToolInfo[] {
  return listAgentToolDefinitions().map((tool) => ({
    id: tool.id,
    label: tool.label,
    description: tool.description
  }))
}

export async function executeAgentActions(actions: AgentAction[]): Promise<AgentExecuteResult> {
  if (!actions.length) {
    return { ok: false, results: [], summary: 'Nenhuma ação para executar.' }
  }

  const results: AgentExecuteResult['results'] = []

  for (const action of actions) {
    validateAction(action)
    const tool = getAgentTool(action.toolId)

    try {
      tool.validate(action.params)
      const result = await tool.execute(action.params)
      results.push({
        actionId: action.id,
        toolId: action.toolId,
        ok: result.ok,
        message: result.message
      })

      if (result.ok) {
        recordAgentAction(action, result.message)
        enqueueMemoryWrite(async () => {
          const event = persistEvent('agent_action', {
            toolId: action.toolId,
            summary: result.message,
            ...action.params
          })
          await indexMemoryPoint({
            id: EVENT_ID_OFFSET + event.id,
            role: 'assistant',
            content: `${action.toolId}: ${result.message}`,
            at: event.at,
            sessionId: getCurrentSessionId(),
            kind: 'event'
          })
        })
      }
    } catch (err) {
      const message = (err as Error).message || 'Falha ao executar a ação.'
      console.error('[agent] action failed:', action.toolId, err)
      results.push({
        actionId: action.id,
        toolId: action.toolId,
        ok: false,
        message
      })
    }
  }

  const ok = results.every((r) => r.ok)
  const summary = results.map((r) => r.message).join(' ')

  return { ok, results, summary: summary || (ok ? 'Pronto!' : 'Algumas ações falharam.') }
}
