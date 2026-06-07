import { randomUUID } from 'node:crypto'
import {
  extractBrowserAppName,
  extractBrowserSearchQuery,
  isMeaningfulSearchQuery,
  wantsBrowserSearch,
  wantsOpenBrowserOnly,
  wantsOpenGoogleHome
} from '../intent'
import type { AgentAction, AgentPlan, AgentToolId } from './types'
import { actionRequiresConfirmation } from './permissions'

function createAction(
  toolId: AgentToolId,
  label: string,
  params: Record<string, string>
): AgentAction {
  return {
    id: randomUUID(),
    toolId,
    label,
    params,
    requiresConfirmation: true
  }
}

function isGreeting(text: string): boolean {
  return /^(oi|olá|ola|hey|eii|bom dia|boa tarde|boa noite|tudo bem|obrigad)/i.test(text)
}

function buildPreamble(actions: AgentAction[]): string {
  if (actions.length === 1) {
    const a = actions[0]
    if (a.toolId === 'openApp') return `Beleza, posso abrir isso pra você!`
    if (a.toolId === 'browserSearch') {
      return `Beleza! Posso abrir o Google com essa busca no seu navegador.`
    }
    if (a.toolId === 'openUrl') return `Posso abrir esse link no navegador!`
  }
  return 'Posso fazer algumas coisas no seu computador — confirma aí?'
}

/** Regex fallback when the LLM planner fails or is unavailable. */
export function planAgentHeuristic(userText: string): AgentPlan {
  const text = userText.trim()
  const lower = text.toLowerCase()

  if (text.length < 6 || isGreeting(lower)) {
    return { needsAgent: false }
  }

  const actions: AgentAction[] = []

  const urlInText = text.match(/https?:\/\/[^\s]+/i)?.[0]
  if (urlInText && /\b(abre|abrir|open|vai para|acessa|acesse|mostra)\b/i.test(lower)) {
    actions.push(createAction('openUrl', `Abrir ${urlInText}`, { url: urlInText }))
  }

  if (wantsOpenBrowserOnly(text)) {
    if (wantsOpenGoogleHome(text)) {
      actions.push(createAction('openUrl', 'Abrir Google', { url: 'https://www.google.com' }))
    } else {
      const app = extractBrowserAppName(text)
      actions.push(createAction('openApp', `Abrir ${app}`, { app }))
    }
  } else if (wantsBrowserSearch(text)) {
    const query = extractBrowserSearchQuery(text)
    if (isMeaningfulSearchQuery(query, text)) {
      actions.push(createAction('browserSearch', `Google: "${query}"`, { query }))
    }
  }

  const openAppMatch = text.match(
    /\b(?:abre|abrir|open|inicia|iniciar|launch)(?:\s+(?:o|a|meu|minha))?\s+([a-záàâãéêíóôõúç0-9][\w\sáàâãéêíóôõúç-]{1,40})/i
  )
  if (openAppMatch) {
    const appRaw = openAppMatch[1]
      .replace(/\b(?:e|depois|pra|para)\b.*/i, '')
      .replace(/\?+$/, '')
      .trim()

    const skipApps = /google|internet|web|link|site|página|pagina|navegador|browser/i
    if (
      appRaw &&
      !skipApps.test(appRaw) &&
      !urlInText &&
      !wantsOpenBrowserOnly(text) &&
      !wantsBrowserSearch(text)
    ) {
      actions.push(createAction('openApp', `Abrir ${appRaw}`, { app: appRaw }))
    }
  }

  if (!actions.length) {
    return { needsAgent: false }
  }

  for (const action of actions) {
    action.requiresConfirmation = actionRequiresConfirmation(action)
  }

  return {
    needsAgent: true,
    preamble: buildPreamble(actions),
    actions
  }
}
