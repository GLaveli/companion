import type { LlmModelOption, LlmProfileId } from '../../shared/types'
import { LLM_MODEL_CATALOG } from '../../shared/llmModels'
import { describeLlmModel, getLlmDir } from './paths'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

interface LlmProfileStore {
  profile: LlmProfileId
}

function storePath(): string {
  return join(app.getPath('userData'), 'llm-profile.json')
}

function listGgufFiles(): string[] {
  const dir = getLlmDir()
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.gguf'))
}

function findFileMatching(files: string[], pattern: RegExp): string | null {
  const match = files.find((f) => pattern.test(f))
  return match ? join(getLlmDir(), match) : null
}

export function listLlmModelOptions(): LlmModelOption[] {
  const files = listGgufFiles()
  const hermesFile =
    files.find((f) => /hermes-3/i.test(f)) ?? files.find((f) => /hermes/i.test(f)) ?? null
  const qwenFile = files.find((f) => /qwen/i.test(f)) ?? null

  return [
    {
      id: 'hermes',
      label: LLM_MODEL_CATALOG.hermes.label,
      file: hermesFile,
      available: !!hermesFile,
      ramHint: LLM_MODEL_CATALOG.hermes.ramHint,
      sizeHint: LLM_MODEL_CATALOG.hermes.sizeHint,
      description: LLM_MODEL_CATALOG.hermes.description
    },
    {
      id: 'qwen',
      label: LLM_MODEL_CATALOG.qwen.label,
      file: qwenFile,
      available: !!qwenFile,
      ramHint: LLM_MODEL_CATALOG.qwen.ramHint,
      sizeHint: LLM_MODEL_CATALOG.qwen.sizeHint,
      description: LLM_MODEL_CATALOG.qwen.description
    }
  ]
}

export async function loadLlmProfile(): Promise<LlmProfileId> {
  try {
    const raw = await readFile(storePath(), 'utf8')
    const parsed = JSON.parse(raw) as LlmProfileStore
    if (parsed.profile === 'hermes' || parsed.profile === 'qwen' || parsed.profile === 'auto') {
      return parsed.profile
    }
  } catch {
    /* first run */
  }
  return 'hermes'
}

export async function saveLlmProfile(profile: LlmProfileId): Promise<LlmProfileId> {
  await mkdir(app.getPath('userData'), { recursive: true })
  await writeFile(storePath(), JSON.stringify({ profile } satisfies LlmProfileStore, null, 2))
  return profile
}

/** Resolve which .gguf to load for the saved or requested profile. */
export function resolveLlmModel(profile: LlmProfileId): string | null {
  const files = listGgufFiles()
  if (!files.length) return null

  const hermes = findFileMatching(files, /hermes-3/i) ?? findFileMatching(files, /hermes/i)
  const qwen = findFileMatching(files, /qwen/i)
  const fallback = join(getLlmDir(), files[0]!)

  if (profile === 'hermes') return hermes ?? qwen ?? fallback
  if (profile === 'qwen') return qwen ?? hermes ?? fallback

  // auto — Hermes first (padrão de desenvolvimento e produção)
  return hermes ?? qwen ?? fallback
}

const PROFILE_LABEL: Record<LlmProfileId, string> = {
  auto: 'Auto',
  hermes: 'Hermes 3',
  qwen: 'Qwen leve'
}

export function describeLlmProfile(profile: LlmProfileId, _modelPath: string | null): string {
  return PROFILE_LABEL[profile] ?? 'Auto'
}
