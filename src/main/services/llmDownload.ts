import { createWriteStream, existsSync } from 'node:fs'
import { mkdir, unlink } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { join } from 'node:path'
import { LLM_MODEL_CATALOG, type LlmCatalogId } from '../../shared/llmModels'
import type { LlmDownloadProgress } from '../../shared/types'
import { getLlmDir } from './paths'

let activeAbort: AbortController | null = null

export function cancelLlmDownload(): void {
  activeAbort?.abort()
}

export function isLlmDownloadActive(): boolean {
  return activeAbort !== null
}

export async function downloadLlmModel(
  profileId: LlmCatalogId,
  onProgress: (progress: LlmDownloadProgress) => void
): Promise<string> {
  if (activeAbort) {
    throw new Error('Já existe um download em andamento.')
  }

  const catalog = LLM_MODEL_CATALOG[profileId]
  const dir = getLlmDir()
  await mkdir(dir, { recursive: true })
  const dest = join(dir, catalog.file)

  if (existsSync(dest)) {
    onProgress({
      profileId,
      phase: 'done',
      percent: 100,
      receivedBytes: 0,
      totalBytes: 0,
      message: 'Modelo já instalado.'
    })
    return dest
  }

  activeAbort = new AbortController()
  const { signal } = activeAbort
  let receivedBytes = 0

  try {
    const res = await fetch(catalog.url, { signal })
    if (!res.ok || !res.body) {
      throw new Error(`Falha no download: HTTP ${res.status}`)
    }

    const totalBytes = Number(res.headers.get('content-length') || 0)
    const emit = (message: string, percent: number): void => {
      onProgress({
        profileId,
        phase: 'downloading',
        percent,
        receivedBytes,
        totalBytes,
        message
      })
    }

    emit(`Baixando ${catalog.label} (${catalog.sizeHint})…`, 0)

    const reader = Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0])
    reader.on('data', (chunk: Buffer) => {
      receivedBytes += chunk.length
      const percent = totalBytes ? Math.min(100, (receivedBytes / totalBytes) * 100) : 0
      const mb = (receivedBytes / 1e6).toFixed(0)
      emit(
        totalBytes
          ? `Baixando ${catalog.shortLabel}… ${percent.toFixed(0)}% (${mb} MB)`
          : `Baixando ${catalog.shortLabel}… ${mb} MB`,
        percent
      )
    })

    await pipeline(reader, createWriteStream(dest), { signal })

    onProgress({
      profileId,
      phase: 'done',
      percent: 100,
      receivedBytes: totalBytes || receivedBytes,
      totalBytes: totalBytes || receivedBytes,
      message: `${catalog.shortLabel} pronto!`
    })
    return dest
  } catch (err) {
    if (existsSync(dest)) {
      await unlink(dest).catch(() => undefined)
    }

    if (signal.aborted) {
      onProgress({
        profileId,
        phase: 'cancelled',
        percent: 0,
        receivedBytes: 0,
        totalBytes: 0,
        message: 'Download cancelado.'
      })
      throw new Error('Download cancelado.')
    }

    const message = (err as Error).message
    onProgress({
      profileId,
      phase: 'error',
      percent: 0,
      receivedBytes: 0,
      totalBytes: 0,
      message
    })
    throw err
  } finally {
    activeAbort = null
  }
}
