import type { EdgeVoiceSettings, Emotion } from '../../../shared/types'

export const DEFAULT_EDGE_VOICE = 'pt-BR-FranciscaNeural'

export interface ProsodyOptions {
  pitch?: string
  rate?: string
  volume?: string
}

export interface SpeechSegment {
  text: string
  prosody: ProsodyOptions
}

function pct(value: number): string {
  return value >= 0 ? `+${value}%` : `${value}%`
}

function parsePct(value: string | undefined): number {
  if (!value) return 0
  const n = Number.parseInt(value.replace('%', ''), 10)
  return Number.isFinite(n) ? n : 0
}

function addPct(base: string | undefined, delta: number): string {
  return pct(parsePct(base) + delta)
}

function emotionDelta(emotion: Emotion): { pitch: number; rate: number } {
  switch (emotion) {
    case 'happy':
      return { pitch: 2, rate: 2 }
    case 'surprised':
      return { pitch: 4, rate: 4 }
    case 'sad':
      return { pitch: -6, rate: -8 }
    case 'thinking':
      return { pitch: -2, rate: -10 }
    case 'angry':
      return { pitch: -2, rate: 6 }
    default:
      return { pitch: 0, rate: 0 }
  }
}

function baseProsody(emotion: Emotion, settings?: EdgeVoiceSettings): ProsodyOptions {
  const s = settings ?? { pitch: 10, rate: 4, volume: 0, edgeVoice: DEFAULT_EDGE_VOICE }
  const delta = emotionDelta(emotion)
  const out: ProsodyOptions = {
    pitch: pct(s.pitch + delta.pitch),
    rate: pct(s.rate + delta.rate)
  }
  // volume=0 distorce a voz no Edge TTS — omitir quando neutro
  if (s.volume !== 0) out.volume = pct(s.volume)
  return out
}

function splitIntoPhrases(text: string): string[] {
  const parts: string[] = []
  const re = /[^.!?…]+(?:[.!?…]+|…)/gu
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    const chunk = match[0].trim()
    if (chunk) parts.push(chunk)
  }
  const consumed = parts.join(' ')
  const tail = text.slice(consumed.length).trim()
  if (tail) parts.push(tail)
  if (!parts.length && text.trim()) parts.push(text.trim())
  return parts
}

function prosodyForPhrase(phrase: string, emotion: Emotion, settings?: EdgeVoiceSettings): ProsodyOptions {
  const base = baseProsody(emotion, settings)
  const trimmed = phrase.trim()

  if (/\?\s*$/.test(trimmed)) {
    return { pitch: addPct(base.pitch, 6), rate: addPct(base.rate, -2), ...(base.volume ? { volume: base.volume } : {}) }
  }
  if (/!\s*$/.test(trimmed)) {
    return { pitch: addPct(base.pitch, 2), rate: addPct(base.rate, 5), ...(base.volume ? { volume: base.volume } : {}) }
  }
  if (/…|\.{3,}/.test(trimmed)) {
    return { pitch: addPct(base.pitch, -4), rate: addPct(base.rate, -12), ...(base.volume ? { volume: base.volume } : {}) }
  }
  if (/^(ah|hmm|pois|nossa|uai|oxe|eita)\b/i.test(trimmed)) {
    return { pitch: addPct(base.pitch, 4), rate: addPct(base.rate, -1), ...(base.volume ? { volume: base.volume } : {}) }
  }
  return base
}

export function planSpeechSegments(
  text: string,
  emotion: Emotion,
  settings?: EdgeVoiceSettings
): SpeechSegment[] {
  const phrases = splitIntoPhrases(text.trim())
  if (!phrases.length) return []

  return phrases.map((phrase) => ({
    text: phrase,
    prosody: prosodyForPhrase(phrase, emotion, settings)
  }))
}
