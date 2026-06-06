// Downloads a light local LLM (GGUF) into models/llm.
// Usage: node scripts/setup-models.mjs
import { createWriteStream, existsSync, mkdirSync } from 'node:fs'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

// A small, capable, multilingual instruct model that runs well on CPU.
const MODEL_URL =
  'https://huggingface.co/bartowski/Qwen2.5-3B-Instruct-GGUF/resolve/main/Qwen2.5-3B-Instruct-Q4_K_M.gguf?download=true'
const MODEL_FILE = 'Qwen2.5-3B-Instruct-Q4_K_M.gguf'

async function main() {
  const llmDir = join(root, 'models', 'llm')
  mkdirSync(llmDir, { recursive: true })
  const dest = join(llmDir, MODEL_FILE)

  if (existsSync(dest)) {
    console.log(`Modelo ja existe: ${dest}`)
    return
  }

  console.log(`Baixando ${MODEL_FILE} (~2 GB)...`)
  const res = await fetch(MODEL_URL)
  if (!res.ok || !res.body) {
    throw new Error(`Falha no download: HTTP ${res.status}`)
  }

  const total = Number(res.headers.get('content-length') || 0)
  let received = 0
  const reader = Readable.fromWeb(res.body)
  reader.on('data', (chunk) => {
    received += chunk.length
    if (total) {
      const pct = ((received / total) * 100).toFixed(1)
      process.stdout.write(`\r  ${pct}%  (${(received / 1e6).toFixed(0)} MB)`)
    }
  })

  await pipeline(reader, createWriteStream(dest))
  console.log(`\nPronto! Modelo salvo em ${dest}`)
}

main().catch((err) => {
  console.error('\nErro:', err.message)
  process.exit(1)
})
