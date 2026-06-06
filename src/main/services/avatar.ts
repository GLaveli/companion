import { app, dialog, BrowserWindow } from 'electron'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename, join } from 'node:path'
import type { AvatarFile, AvatarKind } from '../../shared/types'

function kindFromPath(filePath: string): AvatarKind {
  return filePath.toLowerCase().endsWith('.glb') ? 'glb' : 'vrm'
}

// Remembers which .vrm the user picked so it loads again next launch.
function configPath(): string {
  return join(app.getPath('userData'), 'avatar.json')
}

async function savePickedPath(vrmPath: string): Promise<void> {
  await mkdir(app.getPath('userData'), { recursive: true })
  await writeFile(configPath(), JSON.stringify({ path: vrmPath }), 'utf-8')
}

async function readPickedPath(): Promise<string | null> {
  try {
    if (!existsSync(configPath())) return null
    const raw = await readFile(configPath(), 'utf-8')
    const { path } = JSON.parse(raw) as { path?: string }
    return path && existsSync(path) ? path : null
  } catch {
    return null
  }
}

/** Opens a file picker for a .vrm or .glb (Sketchfab) and returns its bytes. */
export async function pickAvatar(window: BrowserWindow | null): Promise<AvatarFile | null> {
  const result = await dialog.showOpenDialog(window ?? undefined!, {
    title: 'Escolha um avatar 3D',
    properties: ['openFile'],
    filters: [
      { name: 'Avatar 3D', extensions: ['vrm', 'glb'] },
      { name: 'VRM (VRoid, expressoes)', extensions: ['vrm'] },
      { name: 'GLB (Sketchfab)', extensions: ['glb'] }
    ]
  })
  if (result.canceled || !result.filePaths.length) return null
  const filePath = result.filePaths[0]
  const data = await readFile(filePath)
  await savePickedPath(filePath)
  return { name: basename(filePath), kind: kindFromPath(filePath), data }
}

/** Loads the previously picked avatar, if any. */
export async function loadSavedAvatar(): Promise<AvatarFile | null> {
  const vrmPath = await readPickedPath()
  if (!vrmPath) return null
  try {
    const data = await readFile(vrmPath)
    return { name: basename(vrmPath), kind: kindFromPath(vrmPath), data }
  } catch {
    return null
  }
}
