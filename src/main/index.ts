import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { IPC, type AvatarAnimationSettings, type AvatarFile, type AvatarLayout, type EdgeVoiceSettings, type ModelStatus } from '../shared/types'
import { VOICE_PREVIEW_LINE } from '../shared/voiceText'
import { initLlm, chat, chatPlan, chatResearch, resetChat, isLlmReady, reloadLlm, getLlmProfileState, ensureLlmConnection } from './services/llm'
import type { LlmProfileId } from '../shared/types'
import { cancelLlmDownload, downloadLlmModel } from './services/llmDownload'
import { listLlmModelOptions } from './services/llmProfile'
import {
  tryConversationShortcut,
  tryBrowserSearchCommand,
  tryOpenBrowserCommand,
  tryRecallShortcut,
  recordTranscriptTurn
} from './services/conversation'
import { closeMemoryDb, checkMenteHealth, ensureSqliteHealth, getVectorSize, initMemory, initQdrant, shutdownQdrant } from './services/memory'
import { isMemoryRecallIntent } from './services/intent/recallIntent'
import type { MemoryIndicatorState } from '../shared/types'
import { bindDevLogSender, devLog } from './services/devLog'
import { getGptSoVitsStatus, previewEdgeVoice, speak } from './services/tts'
import { startGptSoVitsServer, stopGptSoVitsServer } from './services/gptsovitsProcess'
import { listVoiceEntries, setActiveVoiceProfile } from './services/voiceStore'
import { getEdgeVoiceSettings, saveEdgeVoiceSettings } from './services/edgeVoiceSettings'
import { transcribe, isSttReady, initStt, getSttState, getSttDetail, onSttStatusChange, ensureSttConnection } from './services/stt'
import { pickAvatar, loadSavedAvatar, saveAvatarSelection, resolveAvatarModelUrl } from './services/avatar'
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
import { agentPlan, executeAgentActions, listAgentTools } from './services/agent'
import type { AgentAction } from './services/agent/types'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

let mainWindow: BrowserWindow | null = null
let memoriaReady = false
let menteReady = false
let memoriaState: MemoryIndicatorState = 'inactive'
let menteState: MemoryIndicatorState = 'inactive'
let memoriaDetail = ''
let menteDetail = ''
let lastStatusMessage = ''
let memoriaEverReady = false
let menteEverReady = false
let serviceHealthTimer: ReturnType<typeof setInterval> | null = null
let serviceHealthBusy = false
let lastServiceSnapshot = ''

const SERVICE_HEALTH_MS = 3_000
const MENTE_SETUP_CMD = 'npm run memory:qdrant'

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

  mainWindow.on('ready-to-show', () => {
    bindDevLogSender((entry) => mainWindow?.webContents.send(IPC.onDevLog, entry))
    devLog('app', 'janela pronta')
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Auto-grant camera/microphone for our own renderer.
  const mediaPermissions = new Set(['media', 'microphone', 'camera'])
  const session = mainWindow.webContents.session
  session.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(mediaPermissions.has(permission))
  })
  session.setPermissionCheckHandler((_wc, permission) => mediaPermissions.has(permission))

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    mainWindow.loadURL(devUrl)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function buildModelStatus(message?: string): ModelStatus {
  if (message !== undefined && message !== '') lastStatusMessage = message
  return {
    llmReady: isLlmReady(),
    sttReady: isSttReady(),
    sttState: getSttState(),
    sttDetail: getSttDetail(),
    message: lastStatusMessage,
    memoriaReady,
    menteReady,
    memoriaState,
    menteState,
    memoriaDetail,
    menteDetail
  }
}

function applyMemoriaStatus(healthy: boolean): void {
  memoriaReady = healthy
  if (healthy) {
    memoriaEverReady = true
    memoriaState = 'ready'
    if (!memoriaDetail) memoriaDetail = 'Diário SQLite pronto'
    return
  }

  memoriaState = memoriaEverReady ? 'offline' : 'inactive'
  memoriaDetail = memoriaEverReady
    ? 'Diário SQLite indisponível — reconectando…'
    : 'Diário local — activa automaticamente ao iniciar'
}

function applyMenteStatus(healthy: boolean): void {
  menteReady = healthy
  if (healthy) {
    menteEverReady = true
    menteState = 'ready'
    menteDetail = `Qdrant · ${getVectorSize()} dim`
    return
  }

  menteState = menteEverReady ? 'offline' : 'inactive'
  menteDetail = menteEverReady
    ? `mind1 desconectado — reconectando… (${MENTE_SETUP_CMD})`
    : `Mente opcional — ${MENTE_SETUP_CMD} (Docker aberto)`
}

function serviceSnapshot(): string {
  return JSON.stringify({
    llm: isLlmReady(),
    stt: getSttState(),
    memoria: memoriaReady,
    mente: menteReady
  })
}

async function refreshServiceHealth(): Promise<void> {
  const wasLlmReady = isLlmReady()

  applyMemoriaStatus(ensureSqliteHealth())

  const [, menteOk] = await Promise.all([
    ensureSttConnection(),
    checkMenteHealth(),
    ensureLlmConnection()
  ])

  applyMenteStatus(menteOk)

  if (!wasLlmReady && isLlmReady()) {
    lastStatusMessage = 'Cérebro conectado automaticamente.'
  }

  const snap = serviceSnapshot()
  if (snap !== lastServiceSnapshot) {
    lastServiceSnapshot = snap
    broadcastMemoryStatus()
  }
}

function startServiceHealthCheck(): void {
  if (serviceHealthTimer) return
  serviceHealthTimer = setInterval(() => {
    if (serviceHealthBusy) return
    serviceHealthBusy = true
    void refreshServiceHealth().finally(() => {
      serviceHealthBusy = false
    })
  }, SERVICE_HEALTH_MS)
}

function stopServiceHealthCheck(): void {
  if (!serviceHealthTimer) return
  clearInterval(serviceHealthTimer)
  serviceHealthTimer = null
}

function broadcastStatus(message: string): void {
  mainWindow?.webContents.send(IPC.onStatus, buildModelStatus(message))
}

function broadcastMemoryStatus(): void {
  mainWindow?.webContents.send(IPC.onStatus, buildModelStatus())
}

function broadcastSttStatus(): void {
  mainWindow?.webContents.send(IPC.onStatus, buildModelStatus())
}

function registerIpc(): void {
  ipcMain.handle(IPC.llmChat, async (_e, text: string) => {
    devLog('llm', 'chat', text.slice(0, 80))
    const reply = await chat(text)
    devLog('llm', 'chat ok', reply.text.slice(0, 80))
    return reply
  })
  ipcMain.handle(IPC.llmShortcut, async (_e, text: string) => {
    devLog('ipc', 'shortcut', text.slice(0, 80))

    if (isMemoryRecallIntent(text)) {
      const recall = await tryRecallShortcut(text)
      if (recall) {
        devLog('ipc', 'recall ok', recall.text.slice(0, 60))
        return recall
      }
    }

    const recall = await tryRecallShortcut(text)
    if (recall) {
      devLog('ipc', 'recall ok', recall.text.slice(0, 60))
      return recall
    }
    const openBrowser = await tryOpenBrowserCommand(text)
    if (openBrowser) return openBrowser
    const browser = await tryBrowserSearchCommand(text)
    if (browser) return browser
    return tryConversationShortcut(text)
  })
  ipcMain.handle(
    IPC.conversationRecordTurn,
    async (_e, role: 'user' | 'assistant', content: string) => {
      recordTranscriptTurn(role, content)
    }
  )
  ipcMain.handle(IPC.llmPlan, async (_e, text: string) => chatPlan(text))
  ipcMain.handle(IPC.llmResearch, async (_e, text: string, preamble: string) =>
    chatResearch(text, preamble)
  )
  ipcMain.handle(IPC.llmReset, async () => {
    await resetChat()
  })
  ipcMain.handle(IPC.llmGetProfile, async () => getLlmProfileState())
  ipcMain.handle(IPC.llmSetProfile, async (_e, profile: LlmProfileId) => {
    broadcastStatus('Trocando o cérebro da Lotus...')
    const res = await reloadLlm(profile)
    broadcastStatus(res.message)
    return getLlmProfileState()
  })
  ipcMain.handle(IPC.llmListModels, async () => getLlmProfileState())
  ipcMain.handle(IPC.llmDownloadModel, async (e, profileId: Exclude<LlmProfileId, 'auto'>) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const hadAnyModel = listLlmModelOptions().some((o) => o.available)
    try {
      broadcastStatus(`Baixando ${profileId === 'hermes' ? 'Hermes 3' : 'Qwen leve'}…`)
      await downloadLlmModel(profileId, (progress) => {
        win?.webContents.send(IPC.onLlmDownloadProgress, progress)
      })

      if (!hadAnyModel) {
        broadcastStatus('Carregando o cérebro da Lotus...')
        const res = await reloadLlm(profileId)
        broadcastStatus(res.message)
      } else {
        broadcastStatus(
          `${profileId === 'hermes' ? 'Hermes 3' : 'Qwen leve'} baixado. Troque em Cérebro se quiser usar esse modelo.`
        )
      }

      return { ok: true, state: await getLlmProfileState() }
    } catch (err) {
      const message = (err as Error).message
      broadcastStatus(message)
      return { ok: false, error: message, state: await getLlmProfileState() }
    }
  })
  ipcMain.handle(IPC.llmCancelDownload, async () => {
    cancelLlmDownload()
    return { ok: true }
  })
  ipcMain.handle(IPC.llmStatus, async (): Promise<ModelStatus> => buildModelStatus())
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
  ipcMain.handle(IPC.avatarResolveModelUrl, async (_e, modelUrl: string, preferFile = true) =>
    resolveAvatarModelUrl(modelUrl, preferFile)
  )
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
  ipcMain.handle(IPC.agentPlan, async (_e, text: string) => {
    devLog('agent', 'plan', text.slice(0, 80))
    const plan = await agentPlan(text)
    devLog(
      'agent',
      'plan ok',
      plan.needsAgent
        ? `needsAgent actions=${plan.actions?.length ?? 0}`
        : plan.duplicateMessage
          ? 'duplicate'
          : 'no'
    )
    return plan
  })
  ipcMain.handle(IPC.agentExecute, async (_e, actions: AgentAction[]) => {
    devLog('agent', 'execute', `${actions.length} ação(ões)`)
    const result = await executeAgentActions(actions)
    devLog('agent', 'execute ok', result.summary.slice(0, 80))
    return result
  })
  ipcMain.handle(IPC.agentListTools, async () => listAgentTools())
}

app.whenReady().then(async () => {
  registerIpc()

  const recentTurns = initMemory()
  applyMemoriaStatus(ensureSqliteHealth())
  if (memoriaReady && recentTurns.length > 0) {
    memoriaDetail = `${recentTurns.length} turno(s) carregado(s)`
  }
  devLog('memory', 'SQLite pronto', `${recentTurns.length} turnos carregados`)
  broadcastMemoryStatus()

  createWindow()

  onSttStatusChange(() => broadcastSttStatus())

  // Ouvido (Whisper) em paralelo ao cérebro — não espera o LLM terminar.
  devLog('stt', 'init', 'verificando ouvido (Whisper)')
  void initStt().then((stt) => {
    devLog('stt', stt.ready ? 'pronto' : 'falhou', stt.message.slice(0, 80))
    broadcastSttStatus()
  })

  // Load the LLM in the background so the window can show immediately.
  broadcastStatus('Carregando o cérebro da Lotus...')
  devLog('llm', 'init', 'carregando modelo')
  const res = await initLlm()
  devLog('llm', 'init ok', res.message.slice(0, 120))
  broadcastStatus(res.message)

  // Qdrant + embeddings after UI/LLM — avoids starving Live2D IPC on startup.
  setTimeout(() => {
    void initQdrant().then((ok) => {
      applyMenteStatus(ok)
      broadcastMemoryStatus()
    })
  }, 2500)
  startServiceHealthCheck()
  lastServiceSnapshot = serviceSnapshot()

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

app.on('before-quit', () => {
  stopServiceHealthCheck()
  stopGptSoVitsServer()
  shutdownQdrant()
  closeMemoryDb()
})
