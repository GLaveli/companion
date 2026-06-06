#!/usr/bin/env node
/**
 * Generates the bundled Hiyori preview reference clip (pt-BR, young cheerful tone).
 * GPT-SoVITS v2 clones timbre from ref audio — Japanese ref caused JP accent on Portuguese.
 */
import { spawnSync } from 'node:child_process'
import { mkdir, writeFile, unlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'models', 'voices', 'hiyori-preview')
const mp3Path = join(outDir, '_ref-temp.mp3')
const wavPath = join(outDir, 'ref.wav')
const metaPath = join(outDir, 'meta.json')

const VOICE = 'pt-BR-ThalitaNeural'
const PROMPT_TEXT = 'Oi! Hoje também vamos dar o nosso melhor juntos!'
const PROSODY = { pitch: '+18%', rate: '+8%' }

function collectStream(stream) {
  return new Promise((resolve, reject) => {
    const chunks = []
    stream.on('data', (c) => chunks.push(c))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
    setTimeout(() => reject(new Error('TTS timeout')), 20000)
  })
}

function mp3ToWav(src, dest) {
  if (spawnSync('which', ['afconvert']).status === 0) {
    const r = spawnSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16@24000', src, dest], {
      stdio: 'inherit'
    })
    return r.status === 0
  }
  if (spawnSync('which', ['ffmpeg']).status === 0) {
    const r = spawnSync(
      'ffmpeg',
      ['-y', '-i', src, '-ac', '1', '-ar', '24000', dest],
      { stdio: 'inherit' }
    )
    return r.status === 0
  }
  return false
}

console.log('Gerando audio de referencia pt-BR para Hiyori preview...')
await mkdir(outDir, { recursive: true })

const tts = new MsEdgeTTS()
await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3)
const { audioStream } = tts.toStream(PROMPT_TEXT, PROSODY)
const mp3 = await collectStream(audioStream)
tts.close()

await writeFile(mp3Path, mp3)
if (!mp3ToWav(mp3Path, wavPath)) {
  console.error('Instale ffmpeg ou use macOS (afconvert) para converter MP3 → WAV.')
  process.exit(1)
}
await unlink(mp3Path).catch(() => undefined)

await writeFile(
  metaPath,
  JSON.stringify(
    {
      id: 'hiyori-preview',
      voice: VOICE,
      promptText: PROMPT_TEXT,
      promptLang: 'en',
      textLang: 'en',
      note: 'Referencia pt-BR tom jovem. promptLang/textLang en = proxy fonetico no GPT-SoVITS v2.'
    },
    null,
    2
  ),
  'utf-8'
)

if (existsSync(wavPath)) {
  console.log(`OK: ${wavPath}`)
} else {
  console.error('Falha ao gerar ref.wav')
  process.exit(1)
}
