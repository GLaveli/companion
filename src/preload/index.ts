import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC,
  type AssistantReply,
  type ChatPlan,
  type Emotion,
  type AvatarCollection,
  type AvatarFile,
  type AvatarLayout,
  type CatalogAvatar,
  type CatalogAvatarEntry,
  type EdgeVoiceSettings,
  type GptSoVitsStatus,
  type ModelStatus,
  type TtsResult,
  type VoiceListEntry,
  type VroidLink
} from '../shared/types'

const api = {
  chat: (text: string): Promise<AssistantReply> => ipcRenderer.invoke(IPC.llmChat, text),
  chatPlan: (text: string): Promise<ChatPlan> => ipcRenderer.invoke(IPC.llmPlan, text),
  chatResearch: (text: string, preamble: string): Promise<AssistantReply> =>
    ipcRenderer.invoke(IPC.llmResearch, text, preamble),
  resetChat: (): Promise<void> => ipcRenderer.invoke(IPC.llmReset),
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
  onStatus: (cb: (status: ModelStatus) => void): (() => void) => {
    const listener = (_e: unknown, status: ModelStatus): void => cb(status)
    ipcRenderer.on(IPC.onStatus, listener)
    return () => ipcRenderer.removeListener(IPC.onStatus, listener)
  }
}

export type CompanionApi = typeof api

contextBridge.exposeInMainWorld('companion', api)
