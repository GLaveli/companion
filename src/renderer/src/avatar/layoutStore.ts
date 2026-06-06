import { create } from 'zustand'
import type { AvatarLayout } from '../../../shared/types'
import { AVATAR_LAYOUT_LIMITS, clampLayoutValue } from './layoutLimits'

const DEFAULT_LAYOUT: AvatarLayout = { x: 0.46, y: 0.98, scaleFactor: 0.9 }

let saveTimer: ReturnType<typeof setTimeout> | null = null

interface LayoutState extends AvatarLayout {
  hydrated: boolean
  setLayout: (patch: Partial<AvatarLayout>) => void
  resetLayout: () => void
  hydrate: (layout: AvatarLayout) => void
}

function scheduleSave(layout: AvatarLayout): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    void window.companion.saveAvatarLayout(layout)
  }, 250)
}

export const useAvatarLayout = create<LayoutState>((set, get) => ({
  ...DEFAULT_LAYOUT,
  hydrated: false,

  setLayout: (patch) => {
    set((s) => {
      const next: AvatarLayout = {
        x: clampLayoutValue('x', patch.x ?? s.x),
        y: clampLayoutValue('y', patch.y ?? s.y),
        scaleFactor: clampLayoutValue('scaleFactor', patch.scaleFactor ?? s.scaleFactor)
      }
      scheduleSave(next)
      return next
    })
  },

  resetLayout: () => {
    set({ ...DEFAULT_LAYOUT })
    scheduleSave(DEFAULT_LAYOUT)
  },

  hydrate: (layout) => set({ ...layout, hydrated: true })
}))
