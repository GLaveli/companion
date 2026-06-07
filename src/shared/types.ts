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

/** Whether the next reply should start with a short line while web research runs. */
export interface ChatPlan {
  needsResearch: boolean
  preamble?: string
}

/** Agent tool identifiers — implementations live in main/services/agent/tools/ */
export type AgentToolId = 'openUrl' | 'openApp' | 'browserSearch'

export interface AgentAction {
  id: string
  toolId: AgentToolId
  label: string
  params: Record<string, string>
  requiresConfirmation: boolean
}

export interface AgentPlan {
  needsAgent: boolean
  preamble?: string
  actions?: AgentAction[]
  /** When set, skip execution — e.g. user repeated the same OS action. */
  duplicateMessage?: string
}

export interface AgentToolInfo {
  id: AgentToolId
  label: string
  description: string
}

export interface AgentExecuteResult {
  ok: boolean
  results: Array<{ actionId: string; toolId: AgentToolId; ok: boolean; message: string }>
  summary: string
}

/** Status reported by the main process while models load. */
export type MemoryIndicatorState = 'ready' | 'offline' | 'inactive'

export interface ModelStatus {
  llmReady: boolean
  sttReady: boolean
  message: string
  /** SQLite diary — persistent turns and events. */
  memoriaReady: boolean
  /** Qdrant semantic memory (mind1). */
  menteReady: boolean
  memoriaState: MemoryIndicatorState
  menteState: MemoryIndicatorState
  memoriaDetail?: string
  menteDetail?: string
}

/** Which local GGUF profile to load — both can stay installed in models/llm/. */
export type LlmProfileId = 'auto' | 'hermes' | 'qwen'

export interface LlmModelOption {
  id: Exclude<LlmProfileId, 'auto'>
  label: string
  file: string | null
  available: boolean
  ramHint: string
  sizeHint: string
  description: string
}

export type LlmDownloadPhase = 'downloading' | 'done' | 'error' | 'cancelled'

export interface LlmDownloadProgress {
  profileId: Exclude<LlmProfileId, 'auto'>
  phase: LlmDownloadPhase
  percent: number
  receivedBytes: number
  totalBytes: number
  message: string
}

export interface LlmDownloadResult {
  ok: boolean
  error?: string
  state: LlmProfileState
}

export interface LlmProfileState {
  profile: LlmProfileId
  activeModel: string | null
  options: LlmModelOption[]
}

/** TTS engine identifier. */
export type TtsEngine = 'edge' | 'gptsovits' | 'webspeech'

/** Saved voice profile — Edge preset or GPT-SoVITS clone. */
export interface VoiceProfile {
  id: string
  name: string
  engine: TtsEngine
  /** Edge neural voice id (engine === 'edge'). */
  edgeVoice?: string
  /** Absolute path to reference WAV for GPT-SoVITS. */
  refAudioPath?: string
  /** Transcript of the reference clip. */
  promptText?: string
  /** Language of the reference clip: ja, en, zh, ko, etc. */
  promptLang?: string
  /** Language of text to synthesise (usually pt). */
  textLang?: string
  speedFactor?: number
  gptWeightsPath?: string
  sovitsWeightsPath?: string
  description?: string
}

/** Input for creating a cloned GPT-SoVITS profile. */
export type VoiceProfileInput = Omit<VoiceProfile, 'id' | 'engine'> & {
  id?: string
  engine?: never
}

/** Result of a text-to-speech request. */
export interface TtsResult {
  /** Absolute file:// URL or base64 data URL of the generated audio. */
  audioUrl: string
  engine: TtsEngine
  /** When true the renderer should fall back to the Web Speech API. */
  useWebSpeechFallback?: boolean
  voice?: string
}

export interface GptSoVitsStatus {
  online: boolean
  host: string
  port: number
  message: string
}

export interface VoiceListEntry extends VoiceProfile {
  available: boolean
  active: boolean
}

/** User-tuned Edge TTS parameters (persisted per voice profile id). */
export interface EdgeVoiceSettings {
  /** Base pitch offset in percent points, e.g. 10 = +10%. */
  pitch: number
  /** Base speech rate in percent points, e.g. 4 = +4%. */
  rate: number
  /** Volume offset in percent points. */
  volume: number
  /** Edge neural voice id override. */
  edgeVoice: string
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

/** Live2D eye-gaze behaviour (mutually exclusive modes). */
export type AvatarGazeMode = 'none' | 'mouse' | 'chat' | 'camera'

/** Persisted Live2D animation toggles. */
export interface AvatarAnimationSettings {
  gazeMode: AvatarGazeMode
}

/** CPU/RAM usage reported by the main process. */
export interface SystemMetrics {
  /** Whether values refer to Lotus processes or the whole machine. */
  scope: 'app' | 'system'
  cpuPercent: number
  ramUsedMb: number
  ramTotalMb: number | null
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

/** Curated avatar plus install/availability state for the gallery UI. */
export interface CatalogAvatarEntry extends CatalogAvatar {
  available: boolean
  unavailableReason?: string
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

/** Dev activity line — main process pushes to renderer log panel. */
export interface DevLogEntry {
  ts: number
  source: string
  message: string
  detail?: string
}

export const IPC = {
  // LLM
  llmChat: 'llm:chat',
  llmPlan: 'llm:plan',
  llmResearch: 'llm:research',
  llmShortcut: 'llm:shortcut',
  conversationRecordTurn: 'conversation:record',
  llmStatus: 'llm:status',
  llmReset: 'llm:reset',
  llmGetProfile: 'llm:profile:get',
  llmSetProfile: 'llm:profile:set',
  llmListModels: 'llm:models:list',
  llmDownloadModel: 'llm:model:download',
  llmCancelDownload: 'llm:model:download:cancel',
  onLlmDownloadProgress: 'llm:download:progress',
  // STT
  sttTranscribe: 'stt:transcribe',
  // TTS
  ttsSpeak: 'tts:speak',
  voiceList: 'voice:list',
  voiceGetActive: 'voice:get-active',
  voiceSetActive: 'voice:set-active',
  voiceGptSoVitsStatus: 'voice:gptsovits-status',
  voicePreview: 'voice:preview',
  voiceGetEdgeSettings: 'voice:edge-settings:get',
  voiceSaveEdgeSettings: 'voice:edge-settings:save',
  voicePreviewEdge: 'voice:preview-edge',
  // Avatar
  avatarPick: 'avatar:pick',
  avatarResolveModelUrl: 'avatar:resolve-model-url',
  avatarLoad: 'avatar:load',
  avatarSave: 'avatar:save',
  avatarCatalogCurated: 'avatar:catalog:curated',
  avatarCatalogCollections: 'avatar:catalog:collections',
  avatarCatalogList: 'avatar:catalog:list',
  avatarCatalogVroid: 'avatar:catalog:vroid',
  avatarCatalogDownload: 'avatar:catalog:download',
  avatarLayoutLoad: 'avatar:layout:load',
  avatarLayoutSave: 'avatar:layout:save',
  avatarAnimationLoad: 'avatar:animation:load',
  avatarAnimationSave: 'avatar:animation:save',
  systemMetrics: 'system:metrics',
  // Agent (OS automation)
  agentPlan: 'agent:plan',
  agentExecute: 'agent:execute',
  agentListTools: 'agent:tools',
  // Status events (main -> renderer)
  onStatus: 'app:status',
  onDevLog: 'app:devlog'
} as const
