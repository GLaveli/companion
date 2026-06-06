import type { Emotion, TtsResult } from '../../../shared/types'
import { getActiveVoiceProfile, listVoiceProfiles } from '../voiceStore'
import { getEdgeVoiceSettings } from '../edgeVoiceSettings'
import { speakWithEdge } from './edge'
import { getGptSoVitsStatus, speakWithGptSoVits } from './gptsovits'

export interface SpeakOptions {
  voice?: string
  emotion?: Emotion
}

/**
 * TTS router: uses the active voice profile. GPT-SoVITS when configured and
 * online; otherwise Edge TTS (Francisca).
 */
export async function speak(text: string, options: SpeakOptions = {}): Promise<TtsResult> {
  const emotion = options.emotion ?? 'neutral'
  const profile = await getActiveVoiceProfile()

  if (profile.engine === 'gptsovits') {
    const status = await getGptSoVitsStatus()
    if (status.online && profile.refAudioPath) {
      const result = await speakWithGptSoVits(text, { profile })
      if (result.audioUrl && !result.useWebSpeechFallback) return result
      console.warn('[tts] GPT-SoVITS failed, falling back to Edge:', status.message)
    } else if (!status.online) {
      console.warn('[tts] GPT-SoVITS offline, using Edge fallback.')
    }
  }

  // Edge TTS (perfil edge, ou fallback quando GPT-SoVITS falha)
  const edgeProfileId = profile.engine === 'edge' ? profile.id : 'lotus-francisca'
  const edgeSettings = await getEdgeVoiceSettings(edgeProfileId)

  try {
    return await speakWithEdge(text, {
      voice: options.voice ?? edgeSettings.edgeVoice ?? profile.edgeVoice,
      emotion,
      settings: edgeSettings
    })
  } catch (err) {
    console.error('[tts] Edge TTS failed, falling back to Web Speech:', err)
    return {
      audioUrl: '',
      engine: 'edge',
      useWebSpeechFallback: true,
      voice: profile.edgeVoice
    }
  }
}

export { getGptSoVitsStatus } from './gptsovits'

const EDGE_PREVIEW_LINE =
  'Oi! Eu sou a Lotus, sua companheira virtual. Que bom falar com voce!'

export async function previewEdgeVoice(profileId: string): Promise<TtsResult> {
  const profiles = await listVoiceProfiles()
  const profile = profiles.find((p) => p.id === profileId && p.engine === 'edge')
  if (!profile) {
    return { audioUrl: '', engine: 'edge', useWebSpeechFallback: true }
  }
  const settings = await getEdgeVoiceSettings(profileId)
  return speakWithEdge(EDGE_PREVIEW_LINE, {
    emotion: 'happy',
    voice: settings.edgeVoice ?? profile.edgeVoice,
    settings
  })
}
