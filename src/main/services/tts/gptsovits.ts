import type { GptSoVitsStatus, TtsResult, VoiceProfile } from '../../../shared/types'

const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_PORT = 9880
const HEALTH_TIMEOUT_MS = 2000
const SYNTH_TIMEOUT_MS = 120_000

export interface GptSoVitsSpeakOptions {
  profile: VoiceProfile
  host?: string
  port?: number
}

export async function getGptSoVitsStatus(
  host = DEFAULT_HOST,
  port = DEFAULT_PORT
): Promise<GptSoVitsStatus> {
  try {
    const ping = await fetch(
      `http://${host}:${port}/tts?text=ping&text_lang=pt&ref_audio_path=ping.wav&prompt_lang=pt`,
      { method: 'GET', signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) }
    ).catch(() => null)

    if (!ping) {
      return { online: false, host, port, message: 'Servidor GPT-SoVITS nao encontrado.' }
    }
    // 400 = server is up but params invalid (expected without real ref audio)
    if (ping.status === 400 || ping.ok) {
      return { online: true, host, port, message: 'GPT-SoVITS online.' }
    }
    return { online: false, host, port, message: `Resposta inesperada: ${ping.status}` }
  } catch {
    return { online: false, host, port, message: 'Servidor GPT-SoVITS offline.' }
  }
}

const V2_LANG_ALIASES: Record<string, string> = {
  pt: 'en'
}

function resolveGptLang(code: string | undefined, fallback: string): string {
  const lang = (code ?? fallback).toLowerCase()
  return V2_LANG_ALIASES[lang] ?? lang
}

export async function speakWithGptSoVits(
  text: string,
  options: GptSoVitsSpeakOptions
): Promise<TtsResult> {
  const { profile, host = DEFAULT_HOST, port = DEFAULT_PORT } = options
  const clean = text.trim()
  if (!clean) return { audioUrl: '', engine: 'gptsovits', useWebSpeechFallback: true }

  const refAudioPath = profile.refAudioPath
  if (!refAudioPath) {
    return { audioUrl: '', engine: 'gptsovits', useWebSpeechFallback: true, voice: profile.name }
  }

  const body = {
    text: clean,
    text_lang: resolveGptLang(profile.textLang, 'en'),
    ref_audio_path: refAudioPath,
    prompt_text: profile.promptText ?? '',
    prompt_lang: resolveGptLang(profile.promptLang, 'en'),
    speed_factor: profile.speedFactor ?? 1.0,
    text_split_method: 'cut5',
    media_type: 'wav',
    streaming_mode: false,
    repetition_penalty: 1.35,
    top_p: 1,
    top_k: 15,
    temperature: 1
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SYNTH_TIMEOUT_MS)

  try {
    const res = await fetch(`http://${host}:${port}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    })
    clearTimeout(timer)

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.warn('[gptsovits] synthesis failed:', res.status, errText)
      return { audioUrl: '', engine: 'gptsovits', useWebSpeechFallback: true, voice: profile.name }
    }

    const wav = Buffer.from(await res.arrayBuffer())
    if (!wav.length) {
      return { audioUrl: '', engine: 'gptsovits', useWebSpeechFallback: true, voice: profile.name }
    }

    return {
      audioUrl: `data:audio/wav;base64,${wav.toString('base64')}`,
      engine: 'gptsovits',
      voice: profile.name
    }
  } catch (err) {
    clearTimeout(timer)
    console.warn('[gptsovits] request failed:', err)
    return { audioUrl: '', engine: 'gptsovits', useWebSpeechFallback: true, voice: profile.name }
  }
}
