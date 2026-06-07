import { lipSyncState } from './lipsync'
import type { Playback } from './player'

let sessionId = 0
let activePlayback: Playback | null = null

function stopActivePlayback(): void {
  activePlayback?.stop()
  activePlayback = null
}

function resetLipSyncBridge(): void {
  lipSyncState.manual = null
  lipSyncState.analyser = null
}

/** Stop speech and invalidate in-flight speak / conversation turns. */
export function interruptAll(): number {
  sessionId += 1
  stopActivePlayback()
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
  resetLipSyncBridge()
  return sessionId
}

export function activeSession(): number {
  return sessionId
}

export function isActiveSession(id: number): boolean {
  return id === sessionId
}

export function bindPlayback(playback: Playback, session: number): void {
  if (!isActiveSession(session)) {
    playback.stop()
    return
  }
  if (activePlayback && activePlayback !== playback) {
    activePlayback.stop()
  }
  activePlayback = playback
}

export function releasePlayback(playback: Playback): void {
  if (activePlayback === playback) {
    activePlayback = null
  }
}

export class SpeechInterruptedError extends Error {
  constructor() {
    super('speech interrupted')
    this.name = 'SpeechInterruptedError'
  }
}

export function assertActiveSession(session: number): void {
  if (!isActiveSession(session)) {
    throw new SpeechInterruptedError()
  }
}
