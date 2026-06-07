import type { DevLogEntry } from '../../shared/types'

type DevLogSender = (entry: DevLogEntry) => void

let sender: DevLogSender | null = null

export function bindDevLogSender(fn: DevLogSender): void {
  sender = fn
}

export function devLog(source: string, message: string, detail?: string): void {
  const entry: DevLogEntry = {
    ts: Date.now(),
    source,
    message,
    detail
  }
  console.log(`[lotus:${source}] ${message}${detail ? ` — ${detail}` : ''}`)
  sender?.(entry)
}
