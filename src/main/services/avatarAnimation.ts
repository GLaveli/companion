import { app } from 'electron'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { AvatarAnimationSettings, AvatarGazeMode } from '../../shared/types'

export const DEFAULT_AVATAR_ANIMATION: AvatarAnimationSettings = {
  gazeMode: 'none'
}

const VALID_GAZE: AvatarGazeMode[] = ['none', 'mouse', 'chat', 'camera']

function configPath(): string {
  return join(app.getPath('userData'), 'avatar-animation.json')
}

function normalize(settings: Partial<AvatarAnimationSettings>): AvatarAnimationSettings {
  const mode = settings.gazeMode
  if (mode && VALID_GAZE.includes(mode)) {
    return { gazeMode: mode }
  }
  return { ...DEFAULT_AVATAR_ANIMATION }
}

export async function loadAvatarAnimation(): Promise<AvatarAnimationSettings> {
  try {
    const path = configPath()
    if (!existsSync(path)) return { ...DEFAULT_AVATAR_ANIMATION }
    const raw = await readFile(path, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AvatarAnimationSettings>
    return normalize(parsed)
  } catch {
    return { ...DEFAULT_AVATAR_ANIMATION }
  }
}

export async function saveAvatarAnimation(settings: AvatarAnimationSettings): Promise<void> {
  await mkdir(app.getPath('userData'), { recursive: true })
  const safe = normalize(settings)
  await writeFile(configPath(), JSON.stringify(safe, null, 2), 'utf-8')
}
