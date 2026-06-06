import { app } from 'electron'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { VoiceListEntry, VoiceProfile, VoiceProfileInput } from '../../shared/types'
import { CURATED_VOICES, resolveCuratedProfiles } from './voiceCatalog'

const EDGE_DEFAULT_ID = 'lotus-francisca'

const BUILTIN_PROFILES: VoiceProfile[] = [
  {
    id: EDGE_DEFAULT_ID,
    name: 'Lotus (natural)',
    engine: 'edge',
    edgeVoice: 'pt-BR-FranciscaNeural',
    description: 'Voz feminina brasileira via Edge TTS. Fallback quando GPT-SoVITS está offline.'
  }
]

interface VoiceState {
  activeId: string
  profiles: VoiceProfile[]
}

function storePath(): string {
  return join(app.getPath('userData'), 'voice-profiles.json')
}

export function getVoicesDir(): string {
  return join(app.getPath('userData'), 'voices')
}

function voiceDir(id: string): string {
  return join(getVoicesDir(), id)
}

export function refAudioPathFor(id: string): string {
  return join(voiceDir(id), 'ref.wav')
}

function normalizeProfile(raw: Partial<VoiceProfile>): VoiceProfile | null {
  if (!raw.id || !raw.name || !raw.engine) return null
  return {
    id: raw.id,
    name: raw.name,
    engine: raw.engine,
    edgeVoice: raw.edgeVoice,
    refAudioPath: raw.refAudioPath,
    promptText: raw.promptText,
    promptLang: raw.promptLang,
    textLang: raw.textLang ?? 'pt',
    speedFactor: raw.speedFactor ?? 1,
    gptWeightsPath: raw.gptWeightsPath,
    sovitsWeightsPath: raw.sovitsWeightsPath,
    description: raw.description
  }
}

function curatedProfiles(): VoiceProfile[] {
  return resolveCuratedProfiles()
}

function isReservedId(id: string): boolean {
  return (
    BUILTIN_PROFILES.some((b) => b.id === id) || CURATED_VOICES.some((c) => c.profile.id === id)
  )
}

function mergeProfiles(custom: VoiceProfile[]): VoiceProfile[] {
  const curated = curatedProfiles()
  const reserved = new Set([...BUILTIN_PROFILES, ...curated].map((p) => p.id))
  const userOnly = custom.filter((p) => !reserved.has(p.id))
  return [...BUILTIN_PROFILES, ...curated, ...userOnly]
}

async function loadState(): Promise<VoiceState> {
  try {
    const path = storePath()
    if (!existsSync(path)) {
      return { activeId: EDGE_DEFAULT_ID, profiles: mergeProfiles([]) }
    }
    const parsed = JSON.parse(await readFile(path, 'utf-8')) as Partial<VoiceState>
    const custom = (parsed.profiles ?? [])
      .map(normalizeProfile)
      .filter((p): p is VoiceProfile => p !== null && !isReservedId(p.id))
    const activeId = parsed.activeId ?? EDGE_DEFAULT_ID
    const profiles = mergeProfiles(custom)
    const safeActive = profiles.some((p) => p.id === activeId) ? activeId : EDGE_DEFAULT_ID
    return { activeId: safeActive, profiles }
  } catch {
    return { activeId: EDGE_DEFAULT_ID, profiles: mergeProfiles([]) }
  }
}

async function saveState(state: VoiceState): Promise<void> {
  const custom = state.profiles.filter((p) => !isReservedId(p.id))
  await mkdir(app.getPath('userData'), { recursive: true })
  await writeFile(
    storePath(),
    JSON.stringify({ activeId: state.activeId, profiles: custom }, null, 2),
    'utf-8'
  )
}

export async function listVoiceProfiles(): Promise<VoiceProfile[]> {
  const state = await loadState()
  return state.profiles
}

function isProfileAvailable(profile: VoiceProfile): boolean {
  if (profile.engine === 'edge') return true
  if (profile.engine === 'gptsovits') return Boolean(profile.refAudioPath && existsSync(profile.refAudioPath))
  return false
}

export async function listVoiceEntries(): Promise<VoiceListEntry[]> {
  const state = await loadState()
  return state.profiles.map((profile) => ({
    ...profile,
    available: isProfileAvailable(profile),
    active: profile.id === state.activeId
  }))
}

export async function getActiveVoiceProfile(): Promise<VoiceProfile> {
  const state = await loadState()
  return state.profiles.find((p) => p.id === state.activeId) ?? BUILTIN_PROFILES[0]
}

export async function setActiveVoiceProfile(id: string): Promise<VoiceProfile> {
  const state = await loadState()
  const profile = state.profiles.find((p) => p.id === id)
  if (!profile) throw new Error(`Perfil de voz não encontrado: ${id}`)
  state.activeId = id
  await saveState(state)
  return profile
}

/** Registers a cloned GPT-SoVITS profile (future UI: import ref audio + prompt). */
export async function addClonedVoiceProfile(input: VoiceProfileInput): Promise<VoiceProfile> {
  const state = await loadState()
  const id = input.id ?? randomUUID()
  const refPath = input.refAudioPath ?? refAudioPathFor(id)

  const profile: VoiceProfile = {
    id,
    name: input.name,
    engine: 'gptsovits',
    refAudioPath: refPath,
    promptText: input.promptText,
    promptLang: input.promptLang ?? 'ja',
    textLang: input.textLang ?? 'pt',
    speedFactor: input.speedFactor ?? 1,
    gptWeightsPath: input.gptWeightsPath,
    sovitsWeightsPath: input.sovitsWeightsPath,
    description: input.description ?? 'Voz clonada com GPT-SoVITS.'
  }

  const custom = state.profiles
    .filter((p) => !isReservedId(p.id))
    .filter((p) => p.id !== id)
  custom.push(profile)
  state.profiles = mergeProfiles(custom)
  await saveState(state)
  return profile
}

export async function removeVoiceProfile(id: string): Promise<void> {
  if (isReservedId(id)) {
    throw new Error('Não é possível remover perfis embutidos.')
  }
  const state = await loadState()
  state.profiles = state.profiles.filter((p) => p.id !== id)
  if (state.activeId === id) state.activeId = EDGE_DEFAULT_ID
  await saveState(state)
}
