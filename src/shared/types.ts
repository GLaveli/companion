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

export type AvatarKind = 'vrm' | 'glb'

export interface AvatarFile {
  name: string
  kind: AvatarKind
  /** Raw model bytes; the renderer turns this into a blob URL for the loader. */
  data: Uint8Array
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
  // Status events (main -> renderer)
  onStatus: 'app:status'
} as const
