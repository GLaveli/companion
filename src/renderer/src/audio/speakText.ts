import type { Emotion, TtsResult } from '../../../shared/types'
import { pickResearchFiller } from './researchFiller'
import { playWithAnalyser, speakWithWebSpeechCancellable, type Playback } from './player'
import {
  assertActiveSession,
  bindPlayback,
  isActiveSession,
  releasePlayback,
  SpeechInterruptedError
} from './speechSession'

/** Splits assistant text into TTS-sized chunks (sentences / clauses). */
export function splitSpeechChunks(text: string, maxLen = 200): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []

  const phrases: string[] = []
  const re = /[^.!?…]+(?:[.!?…]+|…)?/gu
  let match: RegExpExecArray | null
  while ((match = re.exec(trimmed)) !== null) {
    const chunk = match[0].trim()
    if (chunk) phrases.push(chunk)
  }
  if (!phrases.length) phrases.push(trimmed)

  const out: string[] = []
  for (const phrase of phrases) {
    if (phrase.length <= maxLen) {
      out.push(phrase)
      continue
    }
    const parts = phrase.split(/(?<=[,;])\s+/)
    let buf = ''
    for (const part of parts) {
      const next = buf ? `${buf} ${part}` : part
      if (next.length > maxLen && buf) {
        out.push(buf)
        buf = part
      } else {
        buf = next
      }
    }
    if (buf) out.push(buf)
  }

  return out
}

async function startSpeech(tts: TtsResult, fallbackText: string): Promise<Playback> {
  if (tts.audioUrl && !tts.useWebSpeechFallback) {
    return playWithAnalyser(tts.audioUrl)
  }
  return speakWithWebSpeechCancellable(fallbackText)
}

async function playTtsResult(
  tts: TtsResult,
  fallbackText: string,
  session: number
): Promise<void> {
  const playback = await startSpeech(tts, fallbackText)
  assertActiveSession(session)
  bindPlayback(playback, session)

  try {
    await playback.done
    assertActiveSession(session)
  } finally {
    releasePlayback(playback)
  }
}

/**
 * Speaks text with pipelined TTS. Pass `session` from {@link interruptAll} so
 * a new user turn can cut playback and skip remaining chunks.
 */
export async function speakText(
  text: string,
  emotion: Emotion = 'neutral',
  session: number
): Promise<void> {
  const chunks = splitSpeechChunks(text)
  if (!chunks.length) return

  if (chunks.length === 1) {
    assertActiveSession(session)
    const tts = await window.companion.speak(text, emotion)
    assertActiveSession(session)
    await playTtsResult(tts, text, session)
    return
  }

  let prefetch = window.companion.speak(chunks[0], emotion)
  for (let i = 0; i < chunks.length; i++) {
    assertActiveSession(session)
    const chunk = chunks[i]
    const tts = await prefetch
    assertActiveSession(session)

    if (i + 1 < chunks.length) {
      prefetch = window.companion.speak(chunks[i + 1], emotion)
    }

    await playTtsResult(tts, chunk, session)
  }
}

/**
 * Keeps speaking short curiosities until `researchPromise` settles.
 * Stops immediately when research finishes or the session is interrupted.
 */
export async function speakResearchFillers<T>(
  researchPromise: Promise<T>,
  userText: string,
  session: number,
  emotion: Emotion = 'thinking'
): Promise<void> {
  let settled = false
  void researchPromise.finally(() => {
    settled = true
  })

  const used = new Set<number>()

  while (!settled && isActiveSession(session)) {
    const filler = pickResearchFiller(userText, used)
    assertActiveSession(session)
    const tts = await window.companion.speak(filler, emotion)

    if (settled || !isActiveSession(session)) return

    const playback = await startSpeech(tts, filler)
    bindPlayback(playback, session)

    await Promise.race([researchPromise, playback.done])

    if (settled || !isActiveSession(session)) {
      playback.stop()
      releasePlayback(playback)
      return
    }

    releasePlayback(playback)
  }
}

export { SpeechInterruptedError }
