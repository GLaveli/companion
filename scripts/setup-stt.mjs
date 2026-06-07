#!/usr/bin/env node
/**
 * Instala o ouvido da Lotus (Whisper local):
 * 1. Baixa ggml-*.bin → models/whisper/
 * 2. Compila whisper-cli em node_modules/nodejs-whisper/cpp/whisper.cpp
 *
 * Deve rodar com Node normal (terminal), não dentro do Electron.
 *
 * Modelos: base (padrão, ~141 MB), small (~466 MB), tiny (~39 MB, menos preciso).
 *   npm run setup:stt
 *   npm run setup:stt -- --model tiny
 *   WHISPER_MODEL=base npm run setup:stt
 */
import { createWriteStream, existsSync, mkdirSync } from 'node:fs'
import { chmodSync } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const MODEL_SIZES = { tiny: '~39 MB', base: '~141 MB', small: '~466 MB' }
const VALID_MODELS = Object.keys(MODEL_SIZES)

function parseModel() {
  const env = process.env.WHISPER_MODEL?.trim().toLowerCase()
  const flagIdx = process.argv.indexOf('--model')
  const flag = flagIdx >= 0 ? process.argv[flagIdx + 1]?.trim().toLowerCase() : null
  const model = flag || env || 'base'
  if (!VALID_MODELS.includes(model)) {
    throw new Error(`Modelo inválido "${model}". Use: ${VALID_MODELS.join(', ')}`)
  }
  return model
}

const MODEL = parseModel()
const MODEL_FILE = `ggml-${MODEL}.bin`
const MODEL_URL = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${MODEL}.bin`
const whisperDir = join(root, 'models', 'whisper')
const modelPath = join(whisperDir, MODEL_FILE)
const whisperCpp = join(root, 'node_modules', 'nodejs-whisper', 'cpp', 'whisper.cpp')
const cliPath = join(whisperCpp, 'build', 'bin', 'whisper-cli')

function run(cmd, args, opts = {}) {
  console.log(`\n> ${cmd} ${args.join(' ')}`)
  const res = spawnSync(cmd, args, { stdio: 'inherit', cwd: opts.cwd ?? root, env: process.env })
  if (res.error) throw res.error
  if (res.status !== 0) {
    throw new Error(`${cmd} falhou (código ${res.status})`)
  }
}

async function downloadModel() {
  mkdirSync(whisperDir, { recursive: true })
  if (existsSync(modelPath)) {
    console.log(`Modelo já existe: ${modelPath}`)
    return
  }

  console.log(`Baixando ${MODEL_FILE} (${MODEL_SIZES[MODEL]})…`)
  const res = await fetch(MODEL_URL)
  if (!res.ok || !res.body) {
    throw new Error(`Download falhou: HTTP ${res.status}`)
  }

  const total = Number(res.headers.get('content-length') || 0)
  let received = 0
  const reader = Readable.fromWeb(res.body)
  reader.on('data', (chunk) => {
    received += chunk.length
    if (total) {
      const pct = ((received / total) * 100).toFixed(1)
      process.stdout.write(`\r  ${pct}% (${(received / 1e6).toFixed(1)} MB)`)
    }
  })

  await pipeline(reader, createWriteStream(modelPath))
  console.log(`\nModelo salvo em ${modelPath}`)
}

function buildWhisperCli() {
  if (existsSync(cliPath)) {
    console.log(`whisper-cli já compilado: ${cliPath}`)
    return
  }

  if (!existsSync(whisperCpp)) {
    throw new Error('nodejs-whisper não encontrado — rode npm install')
  }

  const dlScript = join(whisperCpp, 'models', 'download-ggml-model.sh')
  if (existsSync(dlScript)) {
    try {
      chmodSync(dlScript, 0o755)
    } catch {
      /* ok */
    }
  }

  console.log('Compilando whisper-cli (cmake)… pode levar alguns minutos na 1ª vez.')
  run('cmake', ['-B', 'build', '-DCMAKE_BUILD_TYPE=Release'], { cwd: whisperCpp })
  run('cmake', ['--build', 'build', '--config', 'Release'], { cwd: whisperCpp })

  if (!existsSync(cliPath)) {
    throw new Error(`Build terminou mas ${cliPath} não foi encontrado`)
  }
  console.log(`whisper-cli pronto: ${cliPath}`)
}

async function main() {
  console.log(`Instalando ouvido da Lotus (Whisper ${MODEL})…\n`)
  await downloadModel()
  buildWhisperCli()
  console.log('\nPronto! Reinicie a Lotus (npm run dev) e use o microfone.')
  if (MODEL === 'tiny') {
    console.log('Dica: para melhor reconhecimento em PT, rode: npm run setup:stt -- --model base')
  }
}

main().catch((err) => {
  console.error('\nErro:', err.message)
  console.error('Requisitos: Node, cmake e compilador C++ (Xcode CLI no macOS).')
  process.exit(1)
})
