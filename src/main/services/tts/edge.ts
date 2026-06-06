import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts'
import type { EdgeVoiceSettings, Emotion, TtsResult } from '../../../shared/types'
import { DEFAULT_EDGE_VOICE, planSpeechSegments, type ProsodyOptions } from './prosody'

export interface EdgeSpeakOptions {
  voice?: string
  emotion?: Emotion
  settings?: EdgeVoiceSettings
}

export async function speakWithEdge(
  text: string,
  options: EdgeSpeakOptions = {}
): Promise<TtsResult> {
  const voice = options.voice ?? options.settings?.edgeVoice ?? DEFAULT_EDGE_VOICE
  const emotion = options.emotion ?? 'neutral'
  const clean = text.trim()
  if (!clean) return { audioUrl: '', engine: 'edge', useWebSpeechFallback: true }

  const segments = planSpeechSegments(clean, emotion, options.settings)
  const tts = new MsEdgeTTS()
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3)

  const fallback = baseProsodyFromSettings(options.settings)
  let buffer: Buffer
  if (segments.length <= 1) {
    const prosody = segments[0]?.prosody ?? fallback
    buffer = await synthesizeChunk(tts, clean, prosody)
  } else {
    const parts: Buffer[] = []
    for (const segment of segments) {
      parts.push(await synthesizeChunk(tts, segment.text, segment.prosody))
    }
    buffer = Buffer.concat(parts)
  }

  tts.close()

  if (!buffer.length) {
    return { audioUrl: '', engine: 'edge', useWebSpeechFallback: true, voice }
  }
  return {
    audioUrl: `data:audio/mp3;base64,${buffer.toString('base64')}`,
    engine: 'edge',
    voice
  }
}

function baseProsodyFromSettings(settings?: EdgeVoiceSettings): ProsodyOptions {
  const pitch = settings?.pitch ?? 10
  const rate = settings?.rate ?? 4
  const volume = settings?.volume ?? 0
  const fmt = (n: number): string => (n >= 0 ? `+${n}%` : `${n}%`)
  const out: ProsodyOptions = { pitch: fmt(pitch), rate: fmt(rate) }
  if (volume !== 0) out.volume = fmt(volume)
  return out
}

async function synthesizeChunk(
  tts: MsEdgeTTS,
  text: string,
  prosody: ProsodyOptions
): Promise<Buffer> {
  const { audioStream } = tts.toStream(text, prosody)
  return collectStream(audioStream)
}

function collectStream(stream: NodeJS.ReadableStream, timeoutMs = 20000): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    const timer = setTimeout(() => reject(new Error('TTS stream timeout')), timeoutMs)
    stream.on('data', (c: Buffer) => chunks.push(c))
    stream.on('end', () => {
      clearTimeout(timer)
      resolve(Buffer.concat(chunks))
    })
    stream.on('error', (e) => {
      clearTimeout(timer)
      reject(e)
    })
  })
}
