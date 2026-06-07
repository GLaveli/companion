import { shell } from 'electron'
import type { AgentToolDefinition } from './types'

function buildGoogleSearchUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query.trim())}`
}

export const browserSearchTool: AgentToolDefinition = {
  id: 'browserSearch',
  label: 'Pesquisar no Google (navegador)',
  description:
    'Abre o navegador padrão do sistema com a busca no Google — sem bloquear o app nem pedir permissão extra.',
  validate(params) {
    if (!params.query?.trim()) throw new Error('Termo de busca obrigatório')
  },
  async execute(params) {
    const query = params.query.trim()
    const url = buildGoogleSearchUrl(query)
    await shell.openExternal(url)

    return {
      ok: true,
      message: `Pronto! Abri o Google com "${query}" no seu navegador.`
    }
  }
}
