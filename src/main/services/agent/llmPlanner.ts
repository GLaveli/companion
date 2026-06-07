import { randomUUID } from 'node:crypto'
import type { AgentAction, AgentPlan, AgentToolId } from './types'
import { withEphemeralPlanner, runAgentPlanPrompt } from '../llm'
import { mightNeedAgentAction } from '../intent'
import { canRunLlmAgentPlanner } from '../llmConfig'
import { planAgentHeuristic } from './heuristicPlanner'
import { actionRequiresConfirmation } from './permissions'
import { createPlanFunctions, getAgentPlanSystemPrompt, preambleForActions } from './planFunctions'

const VALID_TOOLS = new Set<AgentToolId>(['browserSearch', 'openApp', 'openUrl'])

type RawPlanAction = {
  tool?: string
  toolId?: string
  params?: Record<string, string>
  label?: string
}

type RawPlan = {
  needsAgent?: boolean
  preamble?: string
  actions?: RawPlanAction[]
}

function createAction(
  toolId: AgentToolId,
  label: string,
  params: Record<string, string>
): AgentAction {
  return {
    id: randomUUID(),
    toolId,
    label,
    params,
    requiresConfirmation: actionRequiresConfirmation({ id: '', toolId, label, params, requiresConfirmation: true })
  }
}

function extractJsonObject(raw: string): string | null {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  return raw.slice(start, end + 1)
}

function normalizeToolId(raw: string | undefined): AgentToolId | null {
  if (!raw) return null
  const key = raw.trim()
  if (key === 'openWebSearch') return 'browserSearch'
  if (VALID_TOOLS.has(key as AgentToolId)) return key as AgentToolId
  return null
}

function parseLlmPlanJson(raw: string): AgentPlan | null {
  const jsonText = extractJsonObject(raw)
  if (!jsonText) return null

  try {
    const parsed = JSON.parse(jsonText) as RawPlan
    if (!parsed.needsAgent) return { needsAgent: false }

    const actions: AgentAction[] = []
    for (const item of parsed.actions ?? []) {
      const toolId = normalizeToolId(item.tool ?? item.toolId)
      if (!toolId || !item.params) continue

      const label =
        item.label ??
        (toolId === 'browserSearch'
          ? `Google: "${item.params.query ?? ''}"`
          : toolId === 'openApp'
            ? `Abrir ${item.params.app ?? 'app'}`
            : `Abrir ${item.params.url ?? 'link'}`)

      actions.push(createAction(toolId, label, item.params))
    }

    if (!actions.length) return null

    return {
      needsAgent: true,
      preamble: parsed.preamble?.trim() || preambleForActions(actions),
      actions
    }
  } catch (err) {
    console.warn('[agent] LLM plan JSON parse failed:', err)
    return null
  }
}

/** Hermes-style tool calling — handlers only record actions (no execution). */
async function planAgentWithTools(userText: string): Promise<AgentPlan | null> {
  const actions: AgentAction[] = []
  const functions = createPlanFunctions((action) => actions.push(action))

  const reply = await withEphemeralPlanner(getAgentPlanSystemPrompt(), (plannerSession) =>
    plannerSession.prompt(userText, {
      functions,
      temperature: 0.12,
      maxTokens: 220,
      topP: 0.85,
      topK: 30
    })
  )

  if (!reply) return null

  try {
    if (actions.length) {
      return {
        needsAgent: true,
        preamble: preambleForActions(actions),
        actions
      }
    }

    return parseLlmPlanJson(reply)
  } catch (err) {
    console.warn('[agent] tool plan failed:', err)
    return null
  }
}

/** JSON fallback for models with weaker native tool calling. */
async function planAgentWithJson(userText: string): Promise<AgentPlan | null> {
  const raw = await runAgentPlanPrompt(userText)
  if (!raw) return null
  return parseLlmPlanJson(raw)
}

/** LLM-first planner — tool calling, then JSON, then regex. */
export async function planAgentWithLlm(userText: string): Promise<AgentPlan | null> {
  const toolPlan = await planAgentWithTools(userText)
  if (toolPlan?.needsAgent && toolPlan.actions?.length) {
    return toolPlan
  }

  return planAgentWithJson(userText)
}

/** Heuristic first; LLM planner only when the message looks like an OS action. */
export async function planAgent(userText: string): Promise<AgentPlan> {
  const heuristic = planAgentHeuristic(userText)
  if (heuristic.needsAgent && heuristic.actions?.length) {
    return heuristic
  }

  if (!mightNeedAgentAction(userText)) {
    return { needsAgent: false }
  }

  if (!canRunLlmAgentPlanner()) {
    return { needsAgent: false }
  }

  const llmPlan = await planAgentWithLlm(userText)
  if (llmPlan?.needsAgent && llmPlan.actions?.length) {
    return llmPlan
  }

  return { needsAgent: false }
}
