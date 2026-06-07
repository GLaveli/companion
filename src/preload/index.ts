import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC,
  type AgentAction,
  type AgentExecuteResult,
  type AgentPlan,
  type AgentToolInfo,
  type AssistantReply,
  type ChatPlan,
  type DevLogEntry,
  type Emotion,
  type AvatarCollection,
  type AvatarFile,
  type AvatarLayout,
  type AvatarAnimationSettings,
  type CatalogAvatar,
  type CatalogAvatarEntry,
  type EdgeVoiceSettings,
  type GptSoVitsStatus,
  type LlmDownloadProgress,
  type LlmDownloadResult,
  type LlmProfileId,
  type LlmProfileState,
  type ModelStatus,
  type SystemMetrics,
  type TtsResult,
  type VoiceListEntry,
  type VroidLink
} from '../shared/types'

const api = {
  chat: (text: string): Promise<AssistantReply> => ipcRenderer.invoke(IPC.llmChat, text),
  conversationShortcut: (text: string): Promise<AssistantReply | null> =>
    ipcRenderer.invoke(IPC.llmShortcut, text),
  recordTurn: (role: 'user' | 'assistant', content: string): Promise<void> =>
    ipcRenderer.invoke(IPC.conversationRecordTurn, role, content),
  chatPlan: (text: string): Promise<ChatPlan> => ipcRenderer.invoke(IPC.llmPlan, text),
  chatResearch: (text: string, preamble: string): Promise<AssistantReply> =>
    ipcRenderer.invoke(IPC.llmResearch, text, preamble),
  resetChat: (): Promise<void> => ipcRenderer.invoke(IPC.llmReset),
  getLlmProfile: (): Promise<LlmProfileState> => ipcRenderer.invoke(IPC.llmGetProfile),
  setLlmProfile: (profile: LlmProfileId): Promise<LlmProfileState> =>
    ipcRenderer.invoke(IPC.llmSetProfile, profile),
  downloadLlmModel: (profileId: Exclude<LlmProfileId, 'auto'>): Promise<LlmDownloadResult> =>
    ipcRenderer.invoke(IPC.llmDownloadModel, profileId),
  cancelLlmDownload: (): Promise<{ ok: boolean }> => ipcRenderer.invoke(IPC.llmCancelDownload),
  onLlmDownloadProgress: (cb: (progress: LlmDownloadProgress) => void): (() => void) => {
    const listener = (_e: unknown, progress: LlmDownloadProgress): void => cb(progress)
    ipcRenderer.on(IPC.onLlmDownloadProgress, listener)
    return () => ipcRenderer.removeListener(IPC.onLlmDownloadProgress, listener)
  },
  getStatus: (): Promise<ModelStatus> => ipcRenderer.invoke(IPC.llmStatus),
  speak: (text: string, emotion?: Emotion, voice?: string): Promise<TtsResult> =>
    ipcRenderer.invoke(IPC.ttsSpeak, text, emotion, voice),
  listVoices: (): Promise<VoiceListEntry[]> => ipcRenderer.invoke(IPC.voiceList),
  getActiveVoice: (): Promise<VoiceListEntry> => ipcRenderer.invoke(IPC.voiceGetActive),
  setActiveVoice: (id: string): Promise<VoiceListEntry> => ipcRenderer.invoke(IPC.voiceSetActive, id),
  getGptSoVitsStatus: (): Promise<GptSoVitsStatus> => ipcRenderer.invoke(IPC.voiceGptSoVitsStatus),
  previewVoice: (): Promise<TtsResult> => ipcRenderer.invoke(IPC.voicePreview),
  getEdgeVoiceSettings: (profileId: string): Promise<EdgeVoiceSettings> =>
    ipcRenderer.invoke(IPC.voiceGetEdgeSettings, profileId),
  saveEdgeVoiceSettings: (profileId: string, settings: EdgeVoiceSettings): Promise<EdgeVoiceSettings> =>
    ipcRenderer.invoke(IPC.voiceSaveEdgeSettings, profileId, settings),
  previewEdgeVoice: (profileId: string): Promise<TtsResult> =>
    ipcRenderer.invoke(IPC.voicePreviewEdge, profileId),
  transcribe: (wav: Uint8Array): Promise<{ text: string }> =>
    ipcRenderer.invoke(IPC.sttTranscribe, wav),
  pickAvatar: (): Promise<AvatarFile | null> => ipcRenderer.invoke(IPC.avatarPick),
  resolveAvatarModelUrl: (modelUrl: string, preferFile = true): Promise<string> =>
    ipcRenderer.invoke(IPC.avatarResolveModelUrl, modelUrl, preferFile),
  loadAvatar: (): Promise<AvatarFile | null> => ipcRenderer.invoke(IPC.avatarLoad),
  saveAvatar: (file: AvatarFile): Promise<AvatarFile> => ipcRenderer.invoke(IPC.avatarSave, file),
  catalogCurated: (): Promise<CatalogAvatarEntry[]> => ipcRenderer.invoke(IPC.avatarCatalogCurated),
  catalogCollections: (): Promise<AvatarCollection[]> =>
    ipcRenderer.invoke(IPC.avatarCatalogCollections),
  catalogList: (projectId: string): Promise<CatalogAvatar[]> =>
    ipcRenderer.invoke(IPC.avatarCatalogList, projectId),
  catalogVroid: (): Promise<VroidLink[]> => ipcRenderer.invoke(IPC.avatarCatalogVroid),
  catalogDownload: (modelUrl: string, name: string): Promise<AvatarFile> =>
    ipcRenderer.invoke(IPC.avatarCatalogDownload, modelUrl, name),
  loadAvatarLayout: (): Promise<AvatarLayout> => ipcRenderer.invoke(IPC.avatarLayoutLoad),
  saveAvatarLayout: (layout: AvatarLayout): Promise<void> =>
    ipcRenderer.invoke(IPC.avatarLayoutSave, layout),
  loadAvatarAnimation: (): Promise<AvatarAnimationSettings> =>
    ipcRenderer.invoke(IPC.avatarAnimationLoad),
  saveAvatarAnimation: (settings: AvatarAnimationSettings): Promise<void> =>
    ipcRenderer.invoke(IPC.avatarAnimationSave, settings),
  getSystemMetrics: (): Promise<SystemMetrics> => ipcRenderer.invoke(IPC.systemMetrics),
  agentPlan: (text: string): Promise<AgentPlan> => ipcRenderer.invoke(IPC.agentPlan, text),
  agentExecute: (actions: AgentAction[]): Promise<AgentExecuteResult> =>
    ipcRenderer.invoke(IPC.agentExecute, actions),
  agentListTools: (): Promise<AgentToolInfo[]> => ipcRenderer.invoke(IPC.agentListTools),
  onStatus: (cb: (status: ModelStatus) => void): (() => void) => {
    const listener = (_e: unknown, status: ModelStatus): void => cb(status)
    ipcRenderer.on(IPC.onStatus, listener)
    return () => ipcRenderer.removeListener(IPC.onStatus, listener)
  },
  onDevLog: (cb: (entry: DevLogEntry) => void): (() => void) => {
    const listener = (_e: unknown, entry: DevLogEntry): void => cb(entry)
    ipcRenderer.on(IPC.onDevLog, listener)
    return () => ipcRenderer.removeListener(IPC.onDevLog, listener)
  },
  relaunchApp: (): Promise<void> => ipcRenderer.invoke(IPC.appRelaunch)
}

export type CompanionApi = typeof api

contextBridge.exposeInMainWorld('companion', api)
