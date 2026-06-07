import { randomUUID } from 'node:crypto'
import { defineChatSessionFunction } from 'node-llama-cpp'
import type { AgentAction } from '../../../shared/types'
import { actionRequiresConfirmation } from './permissions'

function planAction(
  toolId: AgentAction['toolId'],
  label: string,
  params: Record<string, string>
): AgentAction {
  const action: AgentAction = {
    id: randomUUID(),
    toolId,
    label,
    params,
    requiresConfirmation: true
  }
  action.requiresConfirmation = actionRequiresConfirmation(action)
  return action
}

const PLAN_SYSTEM = `Você planeja ações no computador do usuário para a assistente Lotus.

Use as ferramentas disponíveis quando o pedido exigir ação no PC (abrir app, Google, link).
NÃO use ferramentas se o usuário só quer conversar, pesquisa para responder no chat, ou cumprimentos.
NÃO execute nada além de chamar a ferramenta correta — a Lotus pedirá confirmação depois.

browserSearch = pesquisar NO GOOGLE/Navegador (não pesquisa interna).
openApp = abrir aplicativo instalado.
openUrl = abrir um link http(s).`

export function getAgentPlanSystemPrompt(): string {
  return PLAN_SYSTEM
}

export function createPlanFunctions(collect: (action: AgentAction) => void) {
  return {
    browserSearch: defineChatSessionFunction({
      description:
        'Abrir o Google no navegador padrão com a busca. Use quando pedirem pesquisar NO google/navegador.',
      params: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Termos de busca limpos, sem "no google"' }
        }
      } as const,
      handler({ query }: { query: string }) {
        const q = query.trim()
        collect(planAction('browserSearch', `Google: "${q}"`, { query: q }))
        return { planned: true, tool: 'browserSearch' }
      }
    }),

    openApp: defineChatSessionFunction({
      description: 'Abrir um aplicativo instalado (Chrome, Spotify, Terminal, etc.).',
      params: {
        type: 'object',
        properties: {
          app: { type: 'string', description: 'Nome do app' }
        }
      } as const,
      handler({ app: appName }: { app: string }) {
        const name = appName.trim()
        collect(planAction('openApp', `Abrir ${name}`, { app: name }))
        return { planned: true, tool: 'openApp' }
      }
    }),

    openUrl: defineChatSessionFunction({
      description: 'Abrir um endereço web no navegador padrão.',
      params: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL completa https://...' }
        }
      } as const,
      handler({ url }: { url: string }) {
        const link = url.trim()
        collect(planAction('openUrl', `Abrir ${link}`, { url: link }))
        return { planned: true, tool: 'openUrl' }
      }
    })
  }
}

export function preambleForActions(actions: AgentAction[]): string {
  if (actions.length === 1) {
    const a = actions[0]
    if (a.toolId === 'browserSearch') {
      return 'Beleza! Posso abrir o Google com essa busca no seu navegador.'
    }
    if (a.toolId === 'openApp') return 'Beleza, posso abrir isso pra você!'
    if (a.toolId === 'openUrl') return 'Posso abrir esse link no navegador!'
  }
  return 'Posso fazer algumas coisas no seu computador — confirma aí?'
}
