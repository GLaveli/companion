import { app, dialog, BrowserWindow } from 'electron'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { AvatarFile, AvatarKind } from '../../shared/types'

function kindFromPath(filePath: string): AvatarKind {
  const lower = filePath.toLowerCase()
  if (lower.endsWith('.glb')) return 'glb'
  if (lower.endsWith('.vrm')) return 'vrm'
  return 'live2d'
}

function configPath(): string {
  return join(app.getPath('userData'), 'avatar.json')
}

export async function savePickedPath(modelPath: string): Promise<void> {
  await mkdir(app.getPath('userData'), { recursive: true })
  await writeFile(
    configPath(),
    JSON.stringify({ path: modelPath, kind: kindFromPath(modelPath) }),
    'utf-8'
  )
}

async function readPickedConfig(): Promise<{ path: string; kind: AvatarKind } | null> {
  try {
    if (!existsSync(configPath())) return null
    const raw = await readFile(configPath(), 'utf-8')
    const parsed = JSON.parse(raw) as { path?: string; kind?: AvatarKind }
    if (!parsed.path || !existsSync(parsed.path)) return null
    return { path: parsed.path, kind: parsed.kind ?? kindFromPath(parsed.path) }
  } catch {
    return null
  }
}

function toAvatarFile(filePath: string): AvatarFile {
  return {
    name: basename(dirname(filePath)) || basename(filePath),
    kind: kindFromPath(filePath),
    modelUrl: pathToFileURL(filePath).href
  }
}

/** Opens a file picker for Live2D (.model3.json) or legacy 3D formats. */
export async function pickAvatar(window: BrowserWindow | null): Promise<AvatarFile | null> {
  const result = await dialog.showOpenDialog(window ?? undefined!, {
    title: 'Escolha um avatar Live2D',
    properties: ['openFile'],
    filters: [
      { name: 'Live2D (model3.json)', extensions: ['json'] },
      { name: 'VRM (legado)', extensions: ['vrm'] },
      { name: 'GLB (legado)', extensions: ['glb'] }
    ]
  })
  if (result.canceled || !result.filePaths.length) return null
  const filePath = result.filePaths[0]
  if (!filePath.toLowerCase().endsWith('.model3.json') && kindFromPath(filePath) === 'live2d') {
    return null
  }
  await savePickedPath(filePath)
  return toAvatarFile(filePath)
}

/** Loads the previously picked avatar, if any. */
export async function loadSavedAvatar(): Promise<AvatarFile | null> {
  const saved = await readPickedConfig()
  if (!saved) return null
  try {
    await readFile(saved.path)
    return {
      name: basename(dirname(saved.path)) || basename(saved.path),
      kind: saved.kind,
      modelUrl: pathToFileURL(saved.path).href
    }
  } catch {
    return null
  }
}
