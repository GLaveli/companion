import { app } from 'electron'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { AvatarLayout } from '../../shared/types'

/** Keep in sync with src/renderer/src/avatar/layoutLimits.ts */
const LIMITS = {
  x: { min: 0, max: 1.1 },
  y: { min: 0.25, max: 3.5 },
  scaleFactor: { min: 0.35, max: 3.2 }
} as const

export const DEFAULT_AVATAR_LAYOUT: AvatarLayout = {
  x: 0.46,
  y: 0.98,
  scaleFactor: 0.9
}

function configPath(): string {
  return join(app.getPath('userData'), 'avatar-layout.json')
}

function clampLayout(layout: Partial<AvatarLayout>): AvatarLayout {
  return {
    x: clamp(layout.x ?? DEFAULT_AVATAR_LAYOUT.x, LIMITS.x.min, LIMITS.x.max),
    y: clamp(layout.y ?? DEFAULT_AVATAR_LAYOUT.y, LIMITS.y.min, LIMITS.y.max),
    scaleFactor: clamp(
      layout.scaleFactor ?? DEFAULT_AVATAR_LAYOUT.scaleFactor,
      LIMITS.scaleFactor.min,
      LIMITS.scaleFactor.max
    )
  }
}

export async function loadAvatarLayout(): Promise<AvatarLayout> {
  try {
    const path = configPath()
    if (!existsSync(path)) return { ...DEFAULT_AVATAR_LAYOUT }
    const raw = await readFile(path, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AvatarLayout>
    return clampLayout(parsed)
  } catch {
    return { ...DEFAULT_AVATAR_LAYOUT }
  }
}

export async function saveAvatarLayout(layout: AvatarLayout): Promise<void> {
  await mkdir(app.getPath('userData'), { recursive: true })
  const safe = clampLayout(layout)
  await writeFile(configPath(), JSON.stringify(safe, null, 2), 'utf-8')
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}
