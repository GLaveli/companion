import { nodewhisper } from 'nodejs-whisper'
import { writeFile, unlink, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

// Whisper model size: "tiny"/"base" are light and fast on CPU.
const MODEL_NAME = 'base'

let sttReady = true

export function isSttReady(): boolean {
  return sttReady
}

/**
 * Transcribes a 16 kHz mono WAV (provided as a byte buffer) to Portuguese text
 * using whisper.cpp via nodejs-whisper. Returns the recognised text.
 */
export async function transcribe(wav: Uint8Array): Promise<string> {
  const dir = join(tmpdir(), 'companion-stt')
  await mkdir(dir, { recursive: true })
  const filePath = join(dir, `${randomUUID()}.wav`)
  await writeFile(filePath, Buffer.from(wav))

  try {
    const raw = await nodewhisper(filePath, {
      modelName: MODEL_NAME,
      autoDownloadModelName: MODEL_NAME,
      removeWavFileAfterTranscription: false,
      whisperOptions: {
        language: 'pt',
        outputInText: false,
        outputInSrt: false,
        outputInVtt: false,
        splitOnWord: false
      }
    })
    return cleanTranscript(raw)
  } catch (err) {
    console.error('[stt] transcription failed:', err)
    sttReady = false
    return ''
  } finally {
    unlink(filePath).catch(() => undefined)
  }
}

/** Removes "[00:00:00.000 --> ...]" timestamp prefixes whisper.cpp prints. */
function cleanTranscript(raw: string): string {
  return raw
    .split('\n')
    .map((line) => line.replace(/^\s*\[[^\]]+\]\s*/, '').trim())
    .filter(Boolean)
    .join(' ')
    .trim()
}
