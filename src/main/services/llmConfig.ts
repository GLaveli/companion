import os from 'node:os'
import { isHermesModel } from './paths'

/** Total system RAM in gigabytes (rounded down). */
export function getSystemRamGb(): number {
  return Math.floor(os.totalmem() / 1024 ** 3)
}

/** Cap KV-cache size — llama.cpp "auto" can allocate 8k+ tokens and OOM the machine. */
export function getChatContextSize(modelPath: string): { min?: number; max: number } {
  const ramGb = getSystemRamGb()
  const large = isHermesModel(modelPath)

  if (large) {
    if (ramGb <= 12) return { min: 2048, max: 3072 }
    if (ramGb <= 16) return { min: 2048, max: 4096 }
    return { min: 2048, max: 6144 }
  }

  if (ramGb < 8) return { min: 2048, max: 3072 }
  return { min: 2048, max: 4096 }
}

/** Tiny scratch context for agent planning — created on demand, disposed immediately. */
export const PLANNER_CONTEXT_SIZE = 2048

/** Optional second LLM pass for agent planning (heuristic still handles most OS commands). */
export function canRunLlmAgentPlanner(): boolean {
  return getSystemRamGb() > 12
}

export function getLlmLoadHint(modelPath: string): string | null {
  const ramGb = getSystemRamGb()
  if (isHermesModel(modelPath) && ramGb <= 16) {
    return `RAM do sistema: ~${ramGb} GB — feche outros apps se a resposta demorar.`
  }
  return null
}
