import { create } from 'zustand'
import type { AvatarLayout } from '../../../shared/types'
import { AVATAR_LAYOUT_LIMITS, clampLayoutValue } from './layoutLimits'

const DEFAULT_LAYOUT: AvatarLayout = { x: 0.46, y: 0.98, scaleFactor: 0.9 }

interface LayoutState extends AvatarLayout {
  hydrated: boolean
  setLayout: (patch: Partial<AvatarLayout>) => void
  resetLayout: () => void
  hydrate: (layout: AvatarLayout) => void
}

function persistLayout(layout: AvatarLayout): void {
  void window.companion.saveAvatarLayout(layout).catch((err) => {
    console.warn('[layout] save failed:', err)
  })
}

export function flushAvatarLayoutSave(): void {
  const { hydrated, x, y, scaleFactor } = useAvatarLayout.getState()
  if (!hydrated) return
  persistLayout({ x, y, scaleFactor })
}

export const useAvatarLayout = create<LayoutState>((set) => ({
  ...DEFAULT_LAYOUT,
  hydrated: true,

  setLayout: (patch) => {
    set((s) => {
      const next: AvatarLayout = {
        x: clampLayoutValue('x', patch.x ?? s.x),
        y: clampLayoutValue('y', patch.y ?? s.y),
        scaleFactor: clampLayoutValue('scaleFactor', patch.scaleFactor ?? s.scaleFactor)
      }
      persistLayout(next)
      return next
    })
  },

  resetLayout: () => {
    set({ ...DEFAULT_LAYOUT })
    persistLayout(DEFAULT_LAYOUT)
  },

  hydrate: (layout) =>
    set({
      x: clampLayoutValue('x', layout.x),
      y: clampLayoutValue('y', layout.y),
      scaleFactor: clampLayoutValue('scaleFactor', layout.scaleFactor),
      hydrated: true
    })
}))
