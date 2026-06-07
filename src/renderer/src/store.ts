import { create } from 'zustand'
import type {
  AvatarKind,
  ChatMessage,
  DevLogEntry,
  Emotion,
  MemoryIndicatorState,
  ModelStatus
} from '../../shared/types'

export type Phase = 'idle' | 'listening' | 'thinking' | 'speaking'

interface CompanionState {
  phase: Phase
  emotion: Emotion
  messages: ChatMessage[]
  statusMessage: string
  llmReady: boolean
  memoriaReady: boolean
  menteReady: boolean
  memoriaState: MemoryIndicatorState
  menteState: MemoryIndicatorState
  memoriaDetail: string
  menteDetail: string
  devLogs: DevLogEntry[]
  devLogOpen: boolean
  /** Live audio level (0..1) used to drive lip-sync intensity. */
  speaking: boolean
  /** Blob URL of the loaded avatar, or null to use the placeholder. */
  avatarUrl: string | null
  avatarName: string | null
  avatarKind: AvatarKind | null

  setPhase: (phase: Phase) => void
  setEmotion: (emotion: Emotion) => void
  addMessage: (msg: ChatMessage) => void
  setModelStatus: (status: ModelStatus) => void
  setSpeaking: (speaking: boolean) => void
  setAvatar: (url: string | null, name: string | null, kind?: AvatarKind | null) => void
  pushDevLog: (entry: DevLogEntry) => void
  setDevLogOpen: (open: boolean) => void
  clearDevLogs: () => void
}

export const useStore = create<CompanionState>((set) => ({
  phase: 'idle',
  emotion: 'neutral',
  messages: [],
  statusMessage: 'Iniciando...',
  llmReady: false,
  memoriaReady: false,
  menteReady: false,
  memoriaState: 'inactive',
  menteState: 'inactive',
  memoriaDetail: '',
  menteDetail: '',
  devLogs: [],
  devLogOpen: false,
  speaking: false,
  avatarUrl: null,
  avatarName: null,
  avatarKind: null,

  setPhase: (phase) => set({ phase }),
  setEmotion: (emotion) => set({ emotion }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setModelStatus: (status) =>
    set((s) => ({
      statusMessage: status.message || s.statusMessage,
      llmReady: status.llmReady,
      memoriaReady: status.memoriaReady,
      menteReady: status.menteReady,
      memoriaState: status.memoriaState ?? (status.memoriaReady ? 'ready' : s.memoriaState),
      menteState: status.menteState ?? (status.menteReady ? 'ready' : s.menteState),
      memoriaDetail: status.memoriaDetail ?? s.memoriaDetail,
      menteDetail: status.menteDetail ?? s.menteDetail
    })),
  setSpeaking: (speaking) => set({ speaking }),
  setAvatar: (avatarUrl, avatarName, avatarKind = null) => set({ avatarUrl, avatarName, avatarKind }),
  pushDevLog: (entry) =>
    set((s) => ({ devLogs: [...s.devLogs, entry].slice(-80) })),
  setDevLogOpen: (devLogOpen) => set({ devLogOpen }),
  clearDevLogs: () => set({ devLogs: [] })
}))
