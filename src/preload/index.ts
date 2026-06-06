import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC,
  type AssistantReply,
  type AvatarFile,
  type ModelStatus,
  type TtsResult
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
  onStatus: (cb: (status: ModelStatus) => void): (() => void) => {
    const listener = (_e: unknown, status: ModelStatus): void => cb(status)
    ipcRenderer.on(IPC.onStatus, listener)
    return () => ipcRenderer.removeListener(IPC.onStatus, listener)
  }
}

export type CompanionApi = typeof api

contextBridge.exposeInMainWorld('companion', api)
