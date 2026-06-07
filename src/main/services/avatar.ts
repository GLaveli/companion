import { app, dialog, BrowserWindow } from 'electron'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import type { AvatarFile, AvatarKind } from '../../shared/types'

interface AvatarConfig {
  kind: AvatarKind
  name?: string
  /** Absolute path for file picker selections. */
  path?: string
  /** Bundled path e.g. /models/mao/Mao.model3.json */
  catalogUrl?: string
}

function kindFromPath(filePath: string): AvatarKind {
  const lower = filePath.toLowerCase()
  if (lower.endsWith('.glb')) return 'glb'
  if (lower.endsWith('.vrm')) return 'vrm'
  return 'live2d'
}

function configPath(): string {
  return join(app.getPath('userData'), 'avatar.json')
}

/** Maps `/models/...` URL to on-disk path under renderer public assets. */
export function resolveBundledModelPath(modelUrl: string): string | null {
  const normalized = modelUrl.startsWith('./')
    ? modelUrl.slice(1)
    : modelUrl.startsWith('/')
      ? modelUrl
      : `/${modelUrl}`
  if (!normalized.startsWith('/models/')) return null
  const rel = normalized.slice(1)

  const candidates = [
    join(app.getAppPath(), 'src/renderer/public', rel),
    join(app.getAppPath(), 'out/renderer', rel),
    join(process.resourcesPath, 'app.asar.unpacked', 'out/renderer', rel)
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return null
}

export function bundledModelExists(modelUrl: string): boolean {
  return resolveBundledModelPath(modelUrl) !== null
}

/** Bundled `/models/...` paths break on file:// — resolve to absolute file:// for Live2D. */
export function resolveAvatarModelUrl(modelUrl: string, preferFile = true): string {
  if (modelUrl.startsWith('file://') || /^https?:\/\//i.test(modelUrl)) {
    return modelUrl
  }

  if (!preferFile) {
    if (modelUrl.startsWith('./')) return modelUrl.slice(1)
    return modelUrl
  }

  const disk = resolveBundledModelPath(modelUrl)
  if (disk) return pathToFileURL(disk).href

  return modelUrl
}

export async function saveAvatarSelection(file: AvatarFile): Promise<void> {
  await mkdir(app.getPath('userData'), { recursive: true })

  let config: AvatarConfig
  if (file.modelUrl.startsWith('/models/')) {
    config = { kind: file.kind, name: file.name, catalogUrl: file.modelUrl }
  } else if (file.modelUrl.startsWith('file://')) {
    config = {
      kind: file.kind,
      name: file.name,
      path: fileURLToPath(file.modelUrl)
    }
  } else {
    config = { kind: file.kind, name: file.name, catalogUrl: file.modelUrl }
  }

  await writeFile(configPath(), JSON.stringify(config, null, 2), 'utf-8')
}

async function readAvatarConfig(): Promise<AvatarConfig | null> {
  try {
    if (!existsSync(configPath())) return null
    const raw = await readFile(configPath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AvatarConfig> & { path?: string }
    if (!parsed.kind && !parsed.path && !parsed.catalogUrl) return null

    return {
      kind: parsed.kind ?? (parsed.path ? kindFromPath(parsed.path) : 'live2d'),
      name: parsed.name,
      path: parsed.path,
      catalogUrl: parsed.catalogUrl
    }
  } catch {
    return null
  }
}

function toAvatarFile(filePath: string, name?: string): AvatarFile {
  return {
    name: name ?? (basename(dirname(filePath)) || basename(filePath)),
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
  const file = toAvatarFile(filePath)
  await saveAvatarSelection(file)
  return file
}

/** Loads the previously saved avatar, if any. */
export async function loadSavedAvatar(): Promise<AvatarFile | null> {
  const config = await readAvatarConfig()
  if (!config) return null

  if (config.catalogUrl) {
    if (config.catalogUrl.startsWith('/models/') && !bundledModelExists(config.catalogUrl)) {
      return null
    }
    const fallbackName = basename(config.catalogUrl, '.model3.json')
    return {
      name: config.name ?? fallbackName,
      kind: config.kind,
      modelUrl: config.catalogUrl
    }
  }

  if (config.path && existsSync(config.path)) {
    try {
      await readFile(config.path)
      return toAvatarFile(config.path, config.name)
    } catch {
      return null
    }
  }

  return null
}
