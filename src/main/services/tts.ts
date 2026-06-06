import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts'
import type { TtsResult } from '../../shared/types'

// Female Brazilian-Portuguese neural voice (free via Microsoft Edge).
// Thalita sounds younger and softer than Francisca.
const DEFAULT_VOICE = 'pt-BR-ThalitaMultilingualNeural'

// Pitch raised + slightly slower rate to give a softer, more "anime" feel.
const PROSODY = { pitch: '+18%', rate: '-4%' as const }

/**
 * Synthesises speech for the given text using Edge TTS and returns it as a
 * base64 data URL the renderer can play. If Edge TTS is unreachable (e.g. no
 * internet), signals the renderer to fall back to the offline Web Speech API.
 */
export async function speak(text: string, voice = DEFAULT_VOICE): Promise<TtsResult> {
  const clean = text.trim()
  if (!clean) return { audioUrl: '', engine: 'edge', useWebSpeechFallback: true }

  try {
    const tts = new MsEdgeTTS()
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3)
    const { audioStream } = tts.toStream(clean, PROSODY)

    const buffer = await collectStream(audioStream)
    tts.close()

    if (!buffer.length) {
      return { audioUrl: '', engine: 'edge', useWebSpeechFallback: true, voice }
    }
    return {
      audioUrl: `data:audio/mp3;base64,${buffer.toString('base64')}`,
      engine: 'edge',
      voice
    }
  } catch (err) {
    console.error('[tts] Edge TTS failed, falling back to Web Speech:', err)
    return { audioUrl: '', engine: 'edge', useWebSpeechFallback: true, voice }
  }
}

function collectStream(stream: NodeJS.ReadableStream, timeoutMs = 15000): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    const timer = setTimeout(() => {
      reject(new Error('TTS stream timeout'))
    }, timeoutMs)
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
