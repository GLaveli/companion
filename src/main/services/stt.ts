import { writeFile, unlink, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { SttIndicatorState } from '../../shared/types'
import { resolveCurrentUserName, resolvePreviousUserName } from './conversation/personalFacts'
import { normalizeSttText } from './stt/sttNormalize'
import {
  getWhisperModelLabel,
  isWhisperInstalled,
  runWhisperTranscribe,
  whisperInstallHint
} from './stt/whisperRuntime'

let sttReady = false
let sttState: SttIndicatorState = 'loading'
let sttDetail = 'Verificando ouvido (Whisper)…'
let initPromise: Promise<{ ready: boolean; message: string }> | null = null
let lastEnsureAttempt = 0
let whisperWasInstalled = false

const ENSURE_COOLDOWN_MS = 15_000

type SttStatusListener = (state: SttIndicatorState, detail: string) => void
const listeners = new Set<SttStatusListener>()

export function getSttState(): SttIndicatorState {
  return sttState
}

export function getSttDetail(): string {
  return sttDetail
}

export function isSttReady(): boolean {
  return sttReady
}

export function onSttStatusChange(listener: SttStatusListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function setSttStatus(state: SttIndicatorState, detail: string): void {
  sttState = state
  sttDetail = detail
  for (const listener of listeners) listener(state, detail)
}

/** Verifica se Whisper foi instalado (npm run setup:stt) — não baixa dentro do Electron. */
export function initStt(): Promise<{ ready: boolean; message: string }> {
  if (initPromise) return initPromise

  initPromise = (async () => {
    setSttStatus('loading', 'Verificando ouvido (Whisper)…')

    if (!isWhisperInstalled()) {
      sttReady = false
      initPromise = null
      const hint = whisperInstallHint()
      setSttStatus('offline', hint)
      console.warn('[stt]', hint)
      return { ready: false, message: hint }
    }

    try {
      setSttStatus('loading', 'Aquecendo Whisper…')
      const dir = join(tmpdir(), 'companion-stt')
      await mkdir(dir, { recursive: true })
      const filePath = join(dir, `${randomUUID()}-warmup.wav`)
      await writeFile(filePath, Buffer.from(buildSilentWav(1600, 16000)))
      try {
        await runWhisperTranscribe(filePath)
      } finally {
        await unlink(filePath).catch(() => undefined)
      }

      sttReady = true
      const model = getWhisperModelLabel()
      setSttStatus('ready', `Ouvido pronto (Whisper ${model}) — pode falar pelo microfone.`)
      return { ready: true, message: `Ouvido pronto (Whisper ${model}).` }
    } catch (err) {
      console.error('[stt] init failed:', err)
      sttReady = false
      initPromise = null
      setSttStatus('offline', whisperInstallHint())
      return { ready: false, message: whisperInstallHint() }
    }
  })()

  return initPromise
}

/** Reconecta o ouvido se npm run setup:stt foi executado com a app aberta. */
export async function ensureSttConnection(): Promise<boolean> {
  if (sttReady) return true
  if (initPromise) return false

  const installed = isWhisperInstalled()
  if (!installed) {
    whisperWasInstalled = false
    if (sttState !== 'offline') {
      setSttStatus('offline', whisperInstallHint())
    }
    return false
  }

  if (!whisperWasInstalled) {
    whisperWasInstalled = true
    lastEnsureAttempt = 0
  }

  const now = Date.now()
  if (now - lastEnsureAttempt < ENSURE_COOLDOWN_MS) return false
  lastEnsureAttempt = now

  const res = await initStt()
  return res.ready
}

function buildWhisperPrompt(): string {
  const parts = [
    'Português do Brasil.',
    'Meu nome não é Will, eu sou Guilherme.',
    'Me chamo. Qual é o seu nome. Quem é você.',
    'Abrir o navegador, chrome, safari, google, spotify.'
  ]

  const current = resolveCurrentUserName()
  const previous = resolvePreviousUserName()
  if (current) parts.push(`Usuário: ${current}.`)
  if (previous && previous !== current) parts.push(`Nome antigo: ${previous}.`)

  return parts.join(' ')
}

function buildNormalizeContext() {
  return {
    rejectedName: resolvePreviousUserName(),
    knownName: resolveCurrentUserName()
  }
}

export async function transcribe(wav: Uint8Array): Promise<string> {
  if (!sttReady) {
    await initStt()
  }
  if (!sttReady) return ''

  const dir = join(tmpdir(), 'companion-stt')
  await mkdir(dir, { recursive: true })
  const filePath = join(dir, `${randomUUID()}.wav`)
  await writeFile(filePath, Buffer.from(wav))

  try {
    const raw = await runWhisperTranscribe(filePath, buildWhisperPrompt())
    return normalizeSttText(cleanTranscript(raw), buildNormalizeContext())
  } catch (err) {
    console.error('[stt] transcription failed:', err)
    sttReady = false
    initPromise = null
    setSttStatus('offline', whisperInstallHint())
    return ''
  } finally {
    unlink(filePath).catch(() => undefined)
  }
}

function buildSilentWav(samples: number, sampleRate: number): Uint8Array {
  const buffer = new ArrayBuffer(44 + samples * 2)
  const view = new DataView(buffer)
  const writeString = (offset: number, str: string): void => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }
  writeString(0, 'RIFF')
  view.setUint32(4, 36 + samples * 2, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, samples * 2, true)
  return new Uint8Array(buffer)
}

function cleanTranscript(raw: string): string {
  return raw
    .split('\n')
    .map((line) => line.replace(/^\s*\[[\d:.]+\s*-->\s*[\d:.]+\]\s*/, '').trim())
    .filter((line) => line && !isWhisperLogLine(line))
    .join(' ')
    .trim()
}

function isWhisperLogLine(line: string): boolean {
  return (
    /^(whisper_|ggml_|system_info:|main:|curl:)/.test(line) ||
    line.includes('whisper_print_timings:') ||
    line.includes('task = transcribe')
  )
}
