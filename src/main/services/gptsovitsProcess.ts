import { app } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { spawn, type ChildProcess } from 'node:child_process'
import { getGptSoVitsStatus } from './tts/gptsovits'

let proc: ChildProcess | null = null

function gptRoot(): string {
  return join(app.getAppPath(), 'vendor', 'GPT-SoVITS')
}

function pythonBin(): string {
  const venvPy = join(gptRoot(), '.venv', 'bin', 'python')
  if (existsSync(venvPy)) return venvPy
  return '/opt/homebrew/bin/python3.11'
}

const V2_T2S_CKPT =
  'GPT_SoVITS/pretrained_models/gsv-v2final-pretrained/s1bert25hz-5kh-longer-epoch=12-step=369668.ckpt'

export function isGptSoVitsInstalled(): boolean {
  const root = gptRoot()
  return existsSync(join(root, 'api_v2.py')) && existsSync(join(root, V2_T2S_CKPT))
}

export async function startGptSoVitsServer(): Promise<boolean> {
  if (!isGptSoVitsInstalled()) {
    console.warn('[gptsovits] not installed — run: npm run setup:gptsovits')
    return false
  }

  const status = await getGptSoVitsStatus()
  if (status.online) return true

  if (proc) return false

  const root = gptRoot()
  const py = pythonBin()
  const api = join(root, 'api_v2.py')
  const cfg = join(root, 'GPT_SoVITS', 'configs', 'tts_infer.yaml')

  proc = spawn(py, [api, '-a', '127.0.0.1', '-p', '9880', '-c', cfg], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PYTHONUNBUFFERED: '1' }
  })

  proc.stdout?.on('data', (buf) => console.log('[gptsovits]', buf.toString().trim()))
  proc.stderr?.on('data', (buf) => console.warn('[gptsovits]', buf.toString().trim()))
  proc.on('exit', (code) => {
    console.warn('[gptsovits] process exited:', code)
    proc = null
  })

  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 2000))
    const check = await getGptSoVitsStatus()
    if (check.online) {
      console.log('[gptsovits] server ready on :9880')
      return true
    }
  }

  console.warn('[gptsovits] server did not become ready in time')
  return false
}

export function stopGptSoVitsServer(): void {
  if (!proc) return
  proc.kill('SIGTERM')
  proc = null
}
