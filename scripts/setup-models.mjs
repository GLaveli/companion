// Downloads a local LLM (GGUF) into models/llm.
// Usage:
//   node scripts/setup-models.mjs          → Hermes 3 8B (recomendado, ~5 GB)
//   node scripts/setup-models.mjs --qwen   → Qwen 2.5 3B (leve, ~2 GB)
import { createWriteStream, existsSync, mkdirSync } from 'node:fs'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import catalog from '../src/shared/llm-models.json' with { type: 'json' }

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

async function main() {
  const useQwen = process.argv.includes('--qwen')
  const profile = useQwen ? catalog.qwen : catalog.hermes

  const llmDir = join(root, 'models', 'llm')
  mkdirSync(llmDir, { recursive: true })
  const dest = join(llmDir, profile.file)

  if (existsSync(dest)) {
    console.log(`Modelo ja existe: ${dest}`)
    return
  }

  console.log(`Baixando ${profile.label} (${profile.sizeHint})...`)
  console.log(`Arquivo: ${profile.file}`)

  const res = await fetch(profile.url)
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
  if (useQwen) {
    console.log('Dica: baixe Hermes 3 pelo painel da Lotus ou com npm run setup:models')
  } else {
    console.log('Dica: baixe Qwen leve pelo painel da Lotus ou com npm run setup:models:qwen')
    console.log('Troque entre Hermes e Qwen no painel da Lotus, em Cerebro.')
  }
}

main().catch((err) => {
  console.error('\nErro:', err.message)
  process.exit(1)
})
