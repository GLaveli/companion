import type { AgentToolId, AgentToolResult } from '../types'

export interface AgentToolDefinition {
  id: AgentToolId
  label: string
  description: string
  /** Validate params before execution; throw on invalid input */
  validate(params: Record<string, string>): void
  execute(params: Record<string, string>): Promise<AgentToolResult>
}
