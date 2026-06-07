import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { cpus } from 'node:os'
import { join } from 'node:path'
import { app } from 'electron'
import { getWhisperDir } from '../paths'

/** Melhor modelo instalado (base > small > tiny). */
const MODEL_PRIORITY = ['ggml-base.bin', 'ggml-small.bin', 'ggml-tiny.bin']

const DEFAULT_WHISPER_PROMPT =
  'Português do Brasil. Meu nome não é Will, eu sou Guilherme. Me chamo. Qual é o seu nome. Quem é você. Abrir o navegador, chrome, safari, google.'

function whisperCppRoot(): string {
  return join(app.getAppPath(), 'node_modules', 'nodejs-whisper', 'cpp', 'whisper.cpp')
}

function pickModelFile(): string {
  const dir = getWhisperDir()
  for (const file of MODEL_PRIORITY) {
    if (existsSync(join(dir, file))) return file
  }
  return MODEL_PRIORITY[MODEL_PRIORITY.length - 1]
}

export function getWhisperModelPath(): string {
  return join(getWhisperDir(), pickModelFile())
}

export function getWhisperModelLabel(): string {
  return pickModelFile().replace('ggml-', '').replace('.bin', '')
}

export function getWhisperCliPath(): string | null {
  const execName = process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli'
  const root = whisperCppRoot()
  const candidates = [
    join(root, 'build', 'bin', execName),
    join(root, 'build', 'bin', 'Release', execName),
    join(root, 'build', 'bin', 'Debug', execName),
    join(root, 'build', execName),
    join(root, execName)
  ]
  return candidates.find((p) => existsSync(p)) ?? null
}

/** Modelo ggml + binário whisper-cli compilados (via npm run setup:stt). */
export function isWhisperInstalled(): boolean {
  const dir = getWhisperDir()
  const hasModel = MODEL_PRIORITY.some((f) => existsSync(join(dir, f)))
  return hasModel && getWhisperCliPath() !== null
}

export function whisperInstallHint(): string {
  return 'Ouvido não instalado — no terminal: npm run setup:stt'
}

export function runWhisperTranscribe(
  wavPath: string,
  prompt: string = DEFAULT_WHISPER_PROMPT
): Promise<string> {
  const cli = getWhisperCliPath()
  const model = getWhisperModelPath()

  if (!cli || !existsSync(model)) {
    return Promise.reject(new Error(whisperInstallHint()))
  }

  const threads = Math.min(8, Math.max(2, cpus().length))

  return new Promise((resolve, reject) => {
    // -np: só o texto; -nt: sem timestamps; -nth: mais sensível a fala baixa
    const args = [
      '-l',
      'pt',
      '-m',
      model,
      '-f',
      wavPath,
      '-np',
      '-nt',
      '-t',
      String(threads),
      '-bs',
      '8',
      '-nth',
      '0.45',
      '--prompt',
      prompt
    ]
    const proc = spawn(cli, args, { cwd: whisperCppRoot() })

    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code !== 0) {
        const detail = (stderr || stdout).trim()
        reject(new Error(detail || `whisper-cli saiu com código ${code}`))
        return
      }
      resolve(stdout)
    })
  })
}
