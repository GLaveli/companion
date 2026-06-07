import { spawn } from 'node:child_process'
import { platform } from 'node:process'
import type { AgentToolDefinition } from './types'

type AppTarget = { darwin: string; win32: string; label: string }

const APP_TARGETS: Record<string, AppTarget> = {
  chrome: { darwin: 'Google Chrome', win32: 'chrome', label: 'Google Chrome' },
  safari: { darwin: 'Safari', win32: 'msedge', label: 'Safari' },
  firefox: { darwin: 'Firefox', win32: 'firefox', label: 'Firefox' },
  edge: { darwin: 'Microsoft Edge', win32: 'msedge', label: 'Microsoft Edge' },
  spotify: { darwin: 'Spotify', win32: 'spotify', label: 'Spotify' },
  discord: { darwin: 'Discord', win32: 'discord', label: 'Discord' },
  terminal: { darwin: 'Terminal', win32: 'wt', label: 'Terminal' },
  finder: { darwin: 'Finder', win32: 'explorer', label: 'Finder' },
  vscode: { darwin: 'Visual Studio Code', win32: 'code', label: 'Visual Studio Code' },
  notes: { darwin: 'Notes', win32: 'notepad', label: 'Notas' },
  calendar: { darwin: 'Calendar', win32: 'outlookcal', label: 'Calendário' },
  navegador: { darwin: 'Safari', win32: 'msedge', label: 'navegador' },
  browser: { darwin: 'Safari', win32: 'msedge', label: 'navegador' }
}

function normalizeAppKey(raw: string): string {
  const key = raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')

  if (/^(google chrome|chrome)$/.test(key)) return 'chrome'
  if (/^(visual studio code|vscode|code)$/.test(key)) return 'vscode'
  if (/^(notas|notes)$/.test(key)) return 'notes'
  if (/^(calendario|calendar)$/.test(key)) return 'calendar'
  if (/^(navegador|browser)$/.test(key)) return 'navegador'

  return key.replace(/\s+/g, '')
}

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { detached: true, stdio: 'ignore' })
    child.on('error', reject)
    child.on('spawn', () => {
      child.unref()
      resolve()
    })
  })
}

async function launchApp(appKey: string): Promise<AppTarget> {
  const target = APP_TARGETS[appKey]
  if (!target) throw new Error(`App não reconhecido: ${appKey}`)

  if (platform === 'darwin') {
    await runCommand('open', ['-a', target.darwin])
    return target
  }
  if (platform === 'win32') {
    await runCommand('cmd', ['/c', 'start', '', target.win32])
    return target
  }

  throw new Error('Abrir apps ainda não suportado nesta plataforma.')
}

export const openAppTool: AgentToolDefinition = {
  id: 'openApp',
  label: 'Abrir aplicativo',
  description: 'Abre um app instalado no computador (Chrome, Spotify, Terminal, etc.).',
  validate(params) {
    if (!params.app?.trim()) throw new Error('Nome do app obrigatório')
    const key = normalizeAppKey(params.app)
    if (!APP_TARGETS[key]) throw new Error(`App não reconhecido: ${params.app}`)
  },
  async execute(params) {
    const key = normalizeAppKey(params.app)
    const target = await launchApp(key)
    return { ok: true, message: `Abri o ${target.label}.` }
  }
}
