export type {
  AgentAction,
  AgentExecuteResult,
  AgentPlan,
  AgentToolId,
  AgentToolInfo
} from '../../../shared/types'

export interface AgentToolResult {
  ok: boolean
  message: string
}
