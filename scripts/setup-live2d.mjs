// Downloads bundled Live2D models + Cubism Core runtime.
// Usage: node scripts/setup-live2d.mjs
// Downloads Hiyori, Mao and Cubism Core runtime.
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'src', 'renderer', 'public')
const cubismDir = join(publicDir, 'cubism')

const GITHUB_BASE =
  'https://raw.githubusercontent.com/Live2D/CubismWebSamples/develop/Samples/Resources'
const CUBISM_CORE_URL = 'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js'

const MODELS = {
  hiyori: {
    dir: join(publicDir, 'models', 'hiyori'),
    modelJson: `${GITHUB_BASE}/Hiyori/Hiyori.model3.json`
  },
  mao: {
    dir: join(publicDir, 'models', 'mao'),
    modelJson: `${GITHUB_BASE}/Mao/Mao.model3.json`
  }
}

async function download(url, dest) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  await mkdir(dirname(dest), { recursive: true })
  await writeFile(dest, buf)
  console.log(`  OK ${dest.replace(publicDir, '')} (${(buf.length / 1024).toFixed(0)} KB)`)
}

function collectPaths(modelJson, prefix) {
  const files = new Set()
  const refs = modelJson.FileReferences
  files.add(refs.Moc)
  for (const tex of refs.Textures ?? []) files.add(tex)
  if (refs.Physics) files.add(refs.Physics)
  if (refs.Pose) files.add(refs.Pose)
  if (refs.UserData) files.add(refs.UserData)
  if (refs.DisplayInfo) files.add(refs.DisplayInfo)
  for (const exp of refs.Expressions ?? []) files.add(exp.File)
  for (const group of Object.values(refs.Motions ?? {})) {
    for (const motion of group) files.add(motion.File)
  }
  return [...files].map((f) => ({ rel: f, url: `${prefix}/${f}` }))
}

async function downloadModel(name, { dir, modelJson }) {
  console.log(`\nBaixando modelo ${name}...`)
  const res = await fetch(modelJson)
  if (!res.ok) throw new Error(`Falha ao baixar ${modelJson}`)
  const json = await res.json()
  const prefix = modelJson.replace(/\/[^/]+$/, '')
  await mkdir(dir, { recursive: true })
  const entryName = modelJson.split('/').pop()
  await writeFile(join(dir, entryName), JSON.stringify(json, null, '\t'))

  for (const { rel, url } of collectPaths(json, prefix)) {
    await download(url, join(dir, rel))
  }
}

async function main() {
  console.log('Baixando Cubism Core...')
  await download(CUBISM_CORE_URL, join(cubismDir, 'live2dcubismcore.min.js'))

  await downloadModel('hiyori', MODELS.hiyori)
  await downloadModel('mao', MODELS.mao)

  console.log('\nLive2D pronto em src/renderer/public/')
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
