import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { VoiceProfile } from '../../shared/types'
import { getBundledVoicesDir } from './paths'

/** Curated GPT-SoVITS preview — young cheerful anime girl timbre for Hiyori. */
export const HIYORI_PREVIEW_ID = 'hiyori-preview'

const HIYORI_PROMPT = 'Oi! Hoje também vamos dar o nosso melhor juntos!'

export interface CuratedVoiceDef {
  profile: Omit<VoiceProfile, 'refAudioPath'>
  refRelative: string
}

export const CURATED_VOICES: CuratedVoiceDef[] = [
  {
    profile: {
      id: HIYORI_PREVIEW_ID,
      name: 'Hiyori (preview anime)',
      engine: 'gptsovits',
      promptText: HIYORI_PROMPT,
      // Referencia em pt-BR; v2 nao tem "pt" — "en" usa fonemas latinos para portugues
      promptLang: 'en',
      textLang: 'en',
      speedFactor: 1.02,
      description:
        'Preview GPT-SoVITS: tom jovem estilo anime falando pt-BR. Teste antes de tornar a voz padrão da Hiyori.'
    },
    refRelative: 'hiyori-preview/ref.wav'
  }
]

export function resolveCuratedProfiles(): VoiceProfile[] {
  const base = getBundledVoicesDir()
  return CURATED_VOICES.map(({ profile, refRelative }) => {
    const refAudioPath = join(base, refRelative)
    return {
      ...profile,
      refAudioPath: existsSync(refAudioPath) ? refAudioPath : undefined
    }
  })
}

export function isCuratedVoiceReady(id: string): boolean {
  const profile = resolveCuratedProfiles().find((p) => p.id === id)
  return Boolean(profile?.refAudioPath)
}
