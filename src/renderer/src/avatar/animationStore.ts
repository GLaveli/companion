import { create } from 'zustand'
import type { AvatarAnimationSettings, AvatarGazeMode } from '../../../shared/types'

const DEFAULT_SETTINGS: AvatarAnimationSettings = { gazeMode: 'none' }

interface AnimationState extends AvatarAnimationSettings {
  hydrated: boolean
  /** True while the chat composer has non-empty text (runtime only). */
  chatTyping: boolean
  setGazeMode: (mode: AvatarGazeMode) => void
  setChatTyping: (active: boolean) => void
  hydrate: (settings: AvatarAnimationSettings) => void
}

function persistSettings(settings: AvatarAnimationSettings): void {
  void window.companion.saveAvatarAnimation(settings).catch((err) => {
    console.warn('[animation] save failed:', err)
  })
}

export function flushAvatarAnimationSave(): void {
  const { hydrated, gazeMode } = useAvatarAnimation.getState()
  if (!hydrated) return
  persistSettings({ gazeMode })
}

export const useAvatarAnimation = create<AnimationState>((set) => ({
  ...DEFAULT_SETTINGS,
  hydrated: false,
  chatTyping: false,

  setGazeMode: (mode) => {
    set({ gazeMode: mode })
    persistSettings({ gazeMode: mode })
  },

  setChatTyping: (active) => set({ chatTyping: active }),

  hydrate: (settings) =>
    set({
      gazeMode: settings.gazeMode ?? 'none',
      hydrated: true
    })
}))
