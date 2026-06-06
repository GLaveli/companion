import { app } from 'electron'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { EdgeVoiceSettings } from '../../shared/types'
import { DEFAULT_EDGE_VOICE } from './tts/prosody'

export const EDGE_VOICE_OPTIONS = [
  { id: 'pt-BR-FranciscaNeural', label: 'Francisca (suave)' },
  { id: 'pt-BR-ThalitaNeural', label: 'Thalita (jovem)' }
] as const

export const DEFAULT_EDGE_SETTINGS: EdgeVoiceSettings = {
  pitch: 10,
  rate: 4,
  volume: 0,
  edgeVoice: DEFAULT_EDGE_VOICE
}

function storePath(): string {
  return join(app.getPath('userData'), 'edge-voice-settings.json')
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function normalize(raw: Partial<EdgeVoiceSettings> | undefined): EdgeVoiceSettings {
  return {
    pitch: clamp(Number(raw?.pitch ?? DEFAULT_EDGE_SETTINGS.pitch), -15, 35),
    rate: clamp(Number(raw?.rate ?? DEFAULT_EDGE_SETTINGS.rate), -25, 30),
    volume: clamp(Number(raw?.volume ?? DEFAULT_EDGE_SETTINGS.volume), -20, 20),
    edgeVoice:
      typeof raw?.edgeVoice === 'string' && raw.edgeVoice.length > 0
        ? raw.edgeVoice
        : DEFAULT_EDGE_SETTINGS.edgeVoice
  }
}

async function loadAll(): Promise<Record<string, EdgeVoiceSettings>> {
  try {
    const path = storePath()
    if (!existsSync(path)) return {}
    const parsed = JSON.parse(await readFile(path, 'utf-8')) as Record<string, Partial<EdgeVoiceSettings>>
    const out: Record<string, EdgeVoiceSettings> = {}
    for (const [id, value] of Object.entries(parsed)) {
      out[id] = normalize(value)
    }
    return out
  } catch {
    return {}
  }
}

async function saveAll(data: Record<string, EdgeVoiceSettings>): Promise<void> {
  await mkdir(app.getPath('userData'), { recursive: true })
  await writeFile(storePath(), JSON.stringify(data, null, 2), 'utf-8')
}

export async function getEdgeVoiceSettings(profileId: string): Promise<EdgeVoiceSettings> {
  const all = await loadAll()
  return all[profileId] ?? { ...DEFAULT_EDGE_SETTINGS }
}

export async function saveEdgeVoiceSettings(
  profileId: string,
  settings: EdgeVoiceSettings
): Promise<EdgeVoiceSettings> {
  const all = await loadAll()
  const normalized = normalize(settings)
  all[profileId] = normalized
  await saveAll(all)
  return normalized
}
