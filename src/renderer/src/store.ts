import { create } from 'zustand'
import type { AvatarKind, ChatMessage, Emotion } from '../../shared/types'

export type Phase = 'idle' | 'listening' | 'thinking' | 'speaking'

interface CompanionState {
  phase: Phase
  emotion: Emotion
  messages: ChatMessage[]
  statusMessage: string
  llmReady: boolean
  /** Live audio level (0..1) used to drive lip-sync intensity. */
  speaking: boolean
  /** Blob URL of the loaded avatar, or null to use the placeholder. */
  avatarUrl: string | null
  avatarName: string | null
  avatarKind: AvatarKind | null

  setPhase: (phase: Phase) => void
  setEmotion: (emotion: Emotion) => void
  addMessage: (msg: ChatMessage) => void
  setStatus: (message: string, llmReady?: boolean) => void
  setSpeaking: (speaking: boolean) => void
  setAvatar: (url: string | null, name: string | null, kind?: AvatarKind | null) => void
}

export const useStore = create<CompanionState>((set) => ({
  phase: 'idle',
  emotion: 'neutral',
  messages: [],
  statusMessage: 'Iniciando...',
  llmReady: false,
  speaking: false,
  avatarUrl: null,
  avatarName: null,
  avatarKind: null,

  setPhase: (phase) => set({ phase }),
  setEmotion: (emotion) => set({ emotion }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setStatus: (statusMessage, llmReady) =>
    set((s) => ({ statusMessage, llmReady: llmReady ?? s.llmReady })),
  setSpeaking: (speaking) => set({ speaking }),
  setAvatar: (avatarUrl, avatarName, avatarKind = null) => set({ avatarUrl, avatarName, avatarKind })
}))
