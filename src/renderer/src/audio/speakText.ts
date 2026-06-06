import type { Emotion, TtsResult } from '../../../shared/types'
import { playWithAnalyser, speakWithWebSpeech } from './player'

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

async function playTtsResult(tts: TtsResult, fallbackText: string): Promise<void> {
  if (tts.audioUrl && !tts.useWebSpeechFallback) {
    const playback = await playWithAnalyser(tts.audioUrl)
    await playback.done
    return
  }
  await speakWithWebSpeech(fallbackText)
}

/**
 * Speaks text with pipelined TTS: synthesizes the next chunk while the current one plays.
 */
export async function speakText(text: string, emotion: Emotion = 'neutral'): Promise<void> {
  const chunks = splitSpeechChunks(text)
  if (!chunks.length) return

  if (chunks.length === 1) {
    const tts = await window.companion.speak(text, emotion)
    await playTtsResult(tts, text)
    return
  }

  let prefetch = window.companion.speak(chunks[0], emotion)
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const tts = await prefetch
    if (i + 1 < chunks.length) {
      prefetch = window.companion.speak(chunks[i + 1], emotion)
    }
    await playTtsResult(tts, chunk)
  }
}
