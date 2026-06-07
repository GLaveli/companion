import { app } from 'electron'
import { join } from 'node:path'
import { EmbeddingModel, FlagEmbedding } from 'fastembed'
import { devLog } from '../devLog'

let embedder: FlagEmbedding | null = null
let vectorSize = 384

function resolveModel(): EmbeddingModel {
  const pref = process.env.LOTUS_EMBED_MODEL?.trim().toLowerCase()
  if (pref === 'bge-small' || pref === 'en') return EmbeddingModel.BGESmallENV15
  // Default: multilingual — Lotus fala pt-BR
  return EmbeddingModel.MLE5Large
}

export function getVectorSize(): number {
  return vectorSize
}

export async function initEmbeddings(): Promise<boolean> {
  if (embedder) return true

  const model = resolveModel()
  vectorSize = model === EmbeddingModel.MLE5Large ? 1024 : 384
  const cacheDir = join(app.getPath('userData'), 'memory', 'embeddings')

  devLog('memory', 'embeddings carregando', model === EmbeddingModel.MLE5Large ? 'multilingual-e5' : 'bge-small')

  try {
    embedder = await FlagEmbedding.init({
      model,
      cacheDir,
      showDownloadProgress: false
    })
    devLog('memory', 'embeddings prontos', `${vectorSize}d`)
    return true
  } catch (err) {
    devLog('memory', 'embeddings falharam', (err as Error).message)
    embedder = null
    return false
  }
}

export async function embedPassage(text: string): Promise<number[] | null> {
  if (!embedder) return null
  const trimmed = text.trim()
  if (!trimmed) return null

  for await (const batch of embedder.passageEmbed([trimmed], 1)) {
    return batch[0] ?? null
  }
  return null
}

export async function embedQuery(text: string): Promise<number[] | null> {
  if (!embedder) return null
  const trimmed = text.trim()
  if (!trimmed) return null
  try {
    return await embedder.queryEmbed(trimmed)
  } catch {
    return null
  }
}
