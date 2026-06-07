import { create } from 'zustand'
import type { AgentAction, AgentPlan } from '../../../shared/types'

interface AgentState {
  pendingPlan: AgentPlan | null
  confirmResolver: ((approved: boolean) => void) | null

  requestConfirmation: (plan: AgentPlan) => Promise<boolean>
  confirm: () => void
  cancel: () => void
  clear: () => void
}

export const useAgentStore = create<AgentState>((set, get) => ({
  pendingPlan: null,
  confirmResolver: null,

  requestConfirmation(plan) {
    return new Promise<boolean>((resolve) => {
      set({ pendingPlan: plan, confirmResolver: resolve })
    })
  },

  confirm() {
    const { confirmResolver } = get()
    confirmResolver?.(true)
    set({ pendingPlan: null, confirmResolver: null })
  },

  cancel() {
    const { confirmResolver } = get()
    confirmResolver?.(false)
    set({ pendingPlan: null, confirmResolver: null })
  },

  clear() {
    const { confirmResolver } = get()
    confirmResolver?.(false)
    set({ pendingPlan: null, confirmResolver: null })
  }
}))

export function pendingAgentActions(plan: AgentPlan | null): AgentAction[] {
  return plan?.actions ?? []
}
