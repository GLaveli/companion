import catalog from './llm-models.json'

export type LlmCatalogId = 'hermes' | 'qwen'

export interface LlmModelCatalogEntry {
  label: string
  shortLabel: string
  sizeHint: string
  file: string
  url: string
  ramHint: string
  description: string
}

export const LLM_MODEL_CATALOG: Record<LlmCatalogId, LlmModelCatalogEntry> = catalog
