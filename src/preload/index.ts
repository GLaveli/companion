import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC,
  type AssistantReply,
  type AvatarCollection,
  type AvatarFile,
  type AvatarLayout,
  type CatalogAvatar,
  type ModelStatus,
  type TtsResult,
  type VroidLink
} from '../shared/types'

const api = {
  chat: (text: string): Promise<AssistantReply> => ipcRenderer.invoke(IPC.llmChat, text),
  resetChat: (): Promise<void> => ipcRenderer.invoke(IPC.llmReset),
  getStatus: (): Promise<ModelStatus> => ipcRenderer.invoke(IPC.llmStatus),
  speak: (text: string, voice?: string): Promise<TtsResult> =>
    ipcRenderer.invoke(IPC.ttsSpeak, text, voice),
  transcribe: (wav: Uint8Array): Promise<{ text: string }> =>
    ipcRenderer.invoke(IPC.sttTranscribe, wav),
  pickAvatar: (): Promise<AvatarFile | null> => ipcRenderer.invoke(IPC.avatarPick),
  loadAvatar: (): Promise<AvatarFile | null> => ipcRenderer.invoke(IPC.avatarLoad),
  catalogCurated: (): Promise<CatalogAvatar[]> => ipcRenderer.invoke(IPC.avatarCatalogCurated),
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
