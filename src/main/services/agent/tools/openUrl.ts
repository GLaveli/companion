import { shell } from 'electron'
import type { AgentToolDefinition } from './types'

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (/^[\w-]+\.[\w.-]+/.test(trimmed)) return `https://${trimmed}`
  throw new Error(`URL inválida: ${raw}`)
}

export const openUrlTool: AgentToolDefinition = {
  id: 'openUrl',
  label: 'Abrir link',
  description: 'Abre um endereço web no navegador padrão do sistema.',
  validate(params) {
    if (!params.url?.trim()) throw new Error('URL obrigatória')
    normalizeUrl(params.url)
  },
  async execute(params) {
    const url = normalizeUrl(params.url)
    await shell.openExternal(url)
    return { ok: true, message: `Abri ${url} no navegador.` }
  }
}
