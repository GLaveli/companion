import { app } from 'electron'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Returns the base directory that holds local AI assets (LLM, whisper, voices).
 * In development this is `<projectRoot>/models`; in a packaged app it is the
 * `models` folder shipped as an extra resource (kept outside the asar).
 */
export function getModelsDir(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'models')
  }
  return join(app.getAppPath(), 'models')
}

export function getLlmDir(): string {
  return join(getModelsDir(), 'llm')
}

export function getWhisperDir(): string {
  return join(getModelsDir(), 'whisper')
}

export function getBundledVoicesDir(): string {
  return join(getModelsDir(), 'voices')
}

export function getLlmModelFileName(modelPath: string | null): string | null {
  if (!modelPath) return null
  return modelPath.split(/[\\/]/).pop() ?? null
}

export function isHermesModel(modelPath: string | null): boolean {
  if (!modelPath) return false
  return /hermes/i.test(modelPath)
}

export function describeLlmModel(modelPath: string | null): string {
  const name = getLlmModelFileName(modelPath)
  if (!name) return 'nenhum'
  if (/hermes-3/i.test(name)) return 'Hermes 3'
  if (/hermes/i.test(name)) return 'Hermes'
  if (/qwen/i.test(name)) return 'Qwen 2.5'
  return name.replace(/\.gguf$/i, '')
}
