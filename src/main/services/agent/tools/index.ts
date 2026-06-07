import type { AgentToolId } from '../types'
import type { AgentToolDefinition } from './types'
import { browserSearchTool } from './browserSearch'
import { openAppTool } from './openApp'
import { openUrlTool } from './openUrl'

const TOOLS: AgentToolDefinition[] = [openUrlTool, openAppTool, browserSearchTool]

const BY_ID = new Map<AgentToolId, AgentToolDefinition>(
  TOOLS.map((tool) => [tool.id, tool])
)

export function listAgentToolDefinitions(): AgentToolDefinition[] {
  return [...TOOLS]
}

export function getAgentTool(id: AgentToolId): AgentToolDefinition {
  const tool = BY_ID.get(id)
  if (!tool) throw new Error(`Ferramenta de agente desconhecida: ${id}`)
  return tool
}
