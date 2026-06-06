import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { IPC, type ModelStatus } from '../shared/types'
import { initLlm, chat, resetChat, isLlmReady } from './services/llm'
import { speak } from './services/tts'
import { transcribe, isSttReady } from './services/stt'
import { pickAvatar, loadSavedAvatar } from './services/avatar'
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
    title: 'Project Companion',
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

  // Auto-grant microphone permission for our own renderer.
  mainWindow.webContents.session.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'media')
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
  ipcMain.handle(IPC.llmReset, async () => {
    await resetChat()
  })
  ipcMain.handle(IPC.llmStatus, async (): Promise<ModelStatus> => ({
    llmReady: isLlmReady(),
    sttReady: isSttReady(),
    message: ''
  }))
  ipcMain.handle(IPC.ttsSpeak, async (_e, text: string, voice?: string) => speak(text, voice))
  ipcMain.handle(IPC.sttTranscribe, async (_e, wav: Uint8Array) => ({ text: await transcribe(wav) }))
  ipcMain.handle(IPC.avatarPick, async () => pickAvatar(mainWindow))
  ipcMain.handle(IPC.avatarLoad, async () => loadSavedAvatar())
  ipcMain.handle(IPC.avatarCatalogCurated, async () => listCurated())
  ipcMain.handle(IPC.avatarCatalogCollections, async () => listCollections())
  ipcMain.handle(IPC.avatarCatalogList, async (_e, projectId: string) =>
    listCollectionAvatars(projectId)
  )
  ipcMain.handle(IPC.avatarCatalogVroid, async () => listVroidLinks())
  ipcMain.handle(IPC.avatarCatalogDownload, async (_e, modelUrl: string, name: string) =>
    downloadCatalogAvatar(modelUrl, name)
  )
}

app.whenReady().then(async () => {
  registerIpc()
  createWindow()

  // Load the LLM in the background so the window can show immediately.
  broadcastStatus('Carregando o cerebro da Lotus...')
  const res = await initLlm()
  broadcastStatus(res.message)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
