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

/** Finds the first .gguf file inside models/llm, or null if none exists. */
export function findLlmModel(): string | null {
  const dir = getLlmDir()
  if (!existsSync(dir)) return null
  const gguf = readdirSync(dir).find((f) => f.toLowerCase().endsWith('.gguf'))
  return gguf ? join(dir, gguf) : null
}
