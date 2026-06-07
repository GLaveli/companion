import type { DevLogEntry } from '../../shared/types'
import { useStore } from './store'

export function logDev(source: string, message: string, detail?: string): void {
  const entry: DevLogEntry = { ts: Date.now(), source, message, detail }
  console.log(`[lotus:${source}] ${message}${detail ? ` — ${detail}` : ''}`)
  useStore.getState().pushDevLog(entry)
}
