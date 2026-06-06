// Downloads bundled VRMA body animations (idle, greeting, pose).
// Usage: node scripts/setup-animations.mjs
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'src', 'renderer', 'public', 'animations')

const FILES = [
  {
    name: 'idle.vrma',
    url: 'https://raw.githubusercontent.com/hirokazuniimoto/virtual-avatar-sdk/main/assets/animations/standard_idle.vrma'
  },
  {
    name: 'greeting.vrma',
    url: 'https://raw.githubusercontent.com/hirokazuniimoto/virtual-avatar-sdk/main/assets/animations/VRMA_02(%E6%8C%A8%E6%8B%B6).vrma'
  },
  {
    name: 'pose.vrma',
    url: 'https://raw.githubusercontent.com/hirokazuniimoto/virtual-avatar-sdk/main/assets/animations/VRMA_06(%E3%83%A2%E3%83%87%E3%83%AB%E3%83%9D%E3%83%BC%E3%82%BA).vrma'
  }
]

async function main() {
  await mkdir(outDir, { recursive: true })
  for (const f of FILES) {
    console.log(`Baixando ${f.name}...`)
    const res = await fetch(f.url)
    if (!res.ok) throw new Error(`Falha: ${f.name} HTTP ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    await writeFile(join(outDir, f.name), buf)
    console.log(`  OK (${(buf.length / 1024).toFixed(0)} KB)`)
  }
  console.log('Animacoes VRMA prontas em src/renderer/public/animations/')
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
