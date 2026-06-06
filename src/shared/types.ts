export type ChatRole = 'user' | 'assistant' | 'system'

export interface ChatMessage {
  role: ChatRole
  content: string
}

/** Emotion hints the avatar can react to. */
export type Emotion = 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'thinking'

export interface AssistantReply {
  text: string
  emotion: Emotion
}

/** Status reported by the main process while models load. */
export interface ModelStatus {
  llmReady: boolean
  sttReady: boolean
  message: string
}

/** Result of a text-to-speech request. */
export interface TtsResult {
  /** Absolute file:// URL or base64 data URL of the generated audio. */
  audioUrl: string
  engine: 'edge' | 'webspeech' | 'piper'
  /** When true the renderer should fall back to the Web Speech API. */
  useWebSpeechFallback?: boolean
  voice?: string
}

export interface TranscriptionResult {
  text: string
}

/** Avatar engine identifier — add new kinds when registering providers. */
export type AvatarKind = 'live2d' | 'vrm' | 'glb'

export interface AvatarFile {
  name: string
  kind: AvatarKind
  /** URL to the model entrypoint (bundled path, file://, or https://). */
  modelUrl: string
}

/** User-tuned Live2D stage framing (persisted in userData). */
export interface AvatarLayout {
  /** Horizontal position as fraction of stage width (0..1). */
  x: number
  /** Vertical position as fraction of stage height (0..1). */
  y: number
  /** Multiplier applied after auto-fit scale. */
  scaleFactor: number
}

export interface CatalogAvatar {
  id: string
  name: string
  projectId: string
  license: string
  thumbnailUrl: string
  modelUrl: string
  description: string
}

export interface AvatarCollection {
  id: string
  name: string
  license: string
  description: string
}

export interface VroidLink {
  name: string
  url: string
  note: string
}

export const IPC = {
  // LLM
  llmChat: 'llm:chat',
  llmStatus: 'llm:status',
  llmReset: 'llm:reset',
  // STT
  sttTranscribe: 'stt:transcribe',
  // TTS
  ttsSpeak: 'tts:speak',
  // Avatar
  avatarPick: 'avatar:pick',
  avatarLoad: 'avatar:load',
  avatarCatalogCurated: 'avatar:catalog:curated',
  avatarCatalogCollections: 'avatar:catalog:collections',
  avatarCatalogList: 'avatar:catalog:list',
  avatarCatalogVroid: 'avatar:catalog:vroid',
  avatarCatalogDownload: 'avatar:catalog:download',
  avatarLayoutLoad: 'avatar:layout:load',
  avatarLayoutSave: 'avatar:layout:save',
  // Status events (main -> renderer)
  onStatus: 'app:status'
} as const
