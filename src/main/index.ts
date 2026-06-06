import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { IPC, type AvatarAnimationSettings, type AvatarFile, type AvatarLayout, type EdgeVoiceSettings, type ModelStatus } from '../shared/types'
import { VOICE_PREVIEW_LINE } from '../shared/voiceText'
import { initLlm, chat, chatPlan, chatResearch, resetChat, isLlmReady } from './services/llm'
import { getGptSoVitsStatus, previewEdgeVoice, speak } from './services/tts'
import { startGptSoVitsServer, stopGptSoVitsServer } from './services/gptsovitsProcess'
import { listVoiceEntries, setActiveVoiceProfile } from './services/voiceStore'
import { getEdgeVoiceSettings, saveEdgeVoiceSettings } from './services/edgeVoiceSettings'
import { transcribe, isSttReady } from './services/stt'
import { pickAvatar, loadSavedAvatar, saveAvatarSelection } from './services/avatar'
import { loadAvatarLayout, saveAvatarLayout } from './services/avatarLayout'
import { loadAvatarAnimation, saveAvatarAnimation } from './services/avatarAnimation'
import { readSystemMetrics } from './services/systemMetrics'
import {
  listCollections,
  listCollectionAvatars,
  listCurated,
  listVroidLinks,
  downloadCatalogAvatar
} from './services/avatarCatalog'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0f0f17',
    title: 'Lotus',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      // The microphone is requested by the renderer; allow it.
      contextIsolation: true,
      nodeIntegration: false,
      // Live2D folders picked locally load via file:// relative assets.
      webSecurity: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Auto-grant camera/microphone for our own renderer.
  mainWindow.webContents.session.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'media' || permission === 'camera')
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    mainWindow.loadURL(devUrl)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function broadcastStatus(message: string): void {
  const status: ModelStatus = {
    llmReady: isLlmReady(),
    sttReady: isSttReady(),
    message
  }
  mainWindow?.webContents.send(IPC.onStatus, status)
}

function registerIpc(): void {
  ipcMain.handle(IPC.llmChat, async (_e, text: string) => chat(text))
  ipcMain.handle(IPC.llmPlan, async (_e, text: string) => chatPlan(text))
  ipcMain.handle(IPC.llmResearch, async (_e, text: string, preamble: string) =>
    chatResearch(text, preamble)
  )
  ipcMain.handle(IPC.llmReset, async () => {
    await resetChat()
  })
  ipcMain.handle(IPC.llmStatus, async (): Promise<ModelStatus> => ({
    llmReady: isLlmReady(),
    sttReady: isSttReady(),
    message: ''
  }))
  ipcMain.handle(IPC.ttsSpeak, async (_e, text: string, emotion, voice) => speak(text, { emotion, voice }))
  ipcMain.handle(IPC.voiceList, async () => listVoiceEntries())
  ipcMain.handle(IPC.voicePreview, async () =>
    speak(VOICE_PREVIEW_LINE, {
      emotion: 'happy'
    })
  )
  ipcMain.handle(IPC.voiceGetActive, async () => {
    const entries = await listVoiceEntries()
    return entries.find((e) => e.active) ?? entries[0]
  })
  ipcMain.handle(IPC.voiceSetActive, async (_e, id: string) => {
    await setActiveVoiceProfile(id)
    const entries = await listVoiceEntries()
    const entry = entries.find((e) => e.id === id)
    if (!entry) throw new Error(`Perfil de voz não encontrado: ${id}`)
    return entry
  })
  ipcMain.handle(IPC.voiceGptSoVitsStatus, async () => getGptSoVitsStatus())
  ipcMain.handle(IPC.voiceGetEdgeSettings, async (_e, profileId: string) =>
    getEdgeVoiceSettings(profileId)
  )
  ipcMain.handle(IPC.voiceSaveEdgeSettings, async (_e, profileId: string, settings: EdgeVoiceSettings) =>
    saveEdgeVoiceSettings(profileId, settings)
  )
  ipcMain.handle(IPC.voicePreviewEdge, async (_e, profileId: string) => previewEdgeVoice(profileId))
  ipcMain.handle(IPC.sttTranscribe, async (_e, wav: Uint8Array) => ({ text: await transcribe(wav) }))
  ipcMain.handle(IPC.avatarPick, async () => pickAvatar(mainWindow))
  ipcMain.handle(IPC.avatarLoad, async () => loadSavedAvatar())
  ipcMain.handle(IPC.avatarSave, async (_e, file: AvatarFile) => {
    await saveAvatarSelection(file)
    return file
  })
  ipcMain.handle(IPC.avatarCatalogCurated, async () => listCurated())
  ipcMain.handle(IPC.avatarCatalogCollections, async () => listCollections())
  ipcMain.handle(IPC.avatarCatalogList, async (_e, projectId: string) =>
    listCollectionAvatars(projectId)
  )
  ipcMain.handle(IPC.avatarCatalogVroid, async () => listVroidLinks())
  ipcMain.handle(IPC.avatarCatalogDownload, async (_e, modelUrl: string, name: string) =>
    downloadCatalogAvatar(modelUrl, name)
  )
  ipcMain.handle(IPC.avatarLayoutLoad, async () => loadAvatarLayout())
  ipcMain.handle(IPC.avatarLayoutSave, async (_e, layout: AvatarLayout) =>
    saveAvatarLayout(layout)
  )
  ipcMain.handle(IPC.avatarAnimationLoad, async () => loadAvatarAnimation())
  ipcMain.handle(IPC.avatarAnimationSave, async (_e, settings: AvatarAnimationSettings) =>
    saveAvatarAnimation(settings)
  )
  ipcMain.handle(IPC.systemMetrics, async () => readSystemMetrics())
}

app.whenReady().then(async () => {
  registerIpc()
  createWindow()

  // Load the LLM in the background so the window can show immediately.
  broadcastStatus('Carregando o cérebro da Lotus...')
  const res = await initLlm()
  broadcastStatus(res.message)

  void startGptSoVitsServer().then((ok) => {
    if (ok) console.log('[app] GPT-SoVITS voice server started')
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  stopGptSoVitsServer()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => stopGptSoVitsServer())
