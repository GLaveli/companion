import {
  extractRecallTopic,
  getRecentEvents,
  getRecentUserMessages,
  indexMemoryPoint,
  isQdrantEnabled,
  persistTurn,
  searchQdrant,
  searchRecallTopicHits,
  searchTurns
} from '../memory'
import { enqueueMemoryWrite } from '../memory/writeQueue'
import { isMemoryRecallIntent } from '../intent/recallIntent'
import { cachePersonalFactsFromText } from './personalFacts'

export interface TranscriptTurn {
  role: 'user' | 'assistant'
  content: string
  at: number
}

const MAX_TURNS = 48
const turns: TranscriptTurn[] = []

export function hydrateTranscript(recent: TranscriptTurn[]): void {
  turns.length = 0
  turns.push(...recent)
}

export function recordTranscriptTurn(role: TranscriptTurn['role'], content: string): void {
  const trimmed = content.trim()
  if (!trimmed) return

  const at = Date.now()
  turns.push({ role, content: trimmed, at })
  while (turns.length > MAX_TURNS) turns.shift()

  if (role === 'user') {
    cachePersonalFactsFromText(trimmed)
  }

  enqueueMemoryWrite(async () => {
    const saved = persistTurn(role, trimmed)
    if (role === 'user') {
      await indexMemoryPoint({
        id: saved.id,
        role,
        content: trimmed,
        at: saved.at,
        sessionId: saved.sessionId,
        kind: 'turn'
      })
    }
  })
}

export function getRecentTranscript(count = 10): TranscriptTurn[] {
  return turns.slice(-count)
}

export function resetTranscript(): void {
  turns.length = 0
}

export function formatTranscriptForPrompt(currentUserText?: string, maxTurns = 6): string {
  let recent = getRecentTranscript(maxTurns + 2)

  if (currentUserText) {
    const trimmed = currentUserText.trim()
    while (
      recent.length &&
      recent[recent.length - 1].role === 'user' &&
      recent[recent.length - 1].content.trim() === trimmed
    ) {
      recent = recent.slice(0, -1)
    }
  }

  if (recent.length === 0) return ''

  return (
    'Histórico desta conversa (só use se for relevante para a pergunta ATUAL):\n' +
    recent.map((t) => `${t.role === 'user' ? 'Usuário' : 'Lotus'}: ${t.content}`).join('\n')
  )
}

function quoteTopic(text: string): string {
  const t = text.trim()
  if (t.length <= 72) return `«${t}»`
  return `«${t.slice(0, 69)}…»`
}

export function isRecallQuestion(text: string): boolean {
  return isMemoryRecallIntent(text)
}

function wantsOlderRecall(text: string): boolean {
  return /\b(?:antes|atr[aá]s|atras|ant(?:es|erior(?:mente)?)|mais tempo|h[aá] (?:muito )?tempo|mais cedo)\b/i.test(
    text.trim().toLowerCase()
  )
}

/** Cumprimentos, nome, meta-recall — não são “assunto” da conversa. */
function isMetaUserTurn(content: string): boolean {
  const t = content.trim().toLowerCase()
  if (t.length < 12) return true
  if (
    /(?:qual|como)\s+(?:o\s+)?meu\s+nome|meu\s+nome\s+(?:é|e|nao|não)|me\s+chamo|qual\s+(?:é|e)\s+(?:o\s+)?seu\s+nome|quem\s+(?:é|e)\s+voc/i.test(
      t
    )
  ) {
    return true
  }
  if (/^(oi|olá|ola|hey|eii+|bom dia|boa tarde|chega|para|sim sim|beleza|ok ok)\b/.test(t)) return true
  if (isMemoryRecallIntent(content)) return true
  return false
}

function formatTopicList(topics: string[]): string {
  if (topics.length === 1) return topics[0]
  if (topics.length === 2) return `${topics[0]} e ${topics[1]}`
  return `${topics.slice(0, -1).join(', ')} e ${topics[topics.length - 1]}`
}

function collectRecallTopics(
  excludeContent: string | undefined,
  mode: 'recent' | 'older'
): string[] {
  const topics: string[] = []

  for (const event of getRecentEvents('browser_search', 5)) {
    const q = (event.payload.query ?? event.payload.q ?? '').trim()
    if (q) topics.push(`pesquisa «${q}»`)
  }

  const substantive = getRecentUserMessages(60, excludeContent).filter(
    (turn) => !isMetaUserTurn(turn.content)
  )

  const slice =
    mode === 'older'
      ? substantive.length > 3
        ? substantive.slice(3, 8)
        : substantive.slice(-Math.min(3, substantive.length))
      : substantive.slice(0, 5)

  for (const turn of slice) {
    topics.push(quoteTopic(turn.content))
  }

  return [...new Set(topics)].slice(0, 4)
}

function isSearchRecallQuestion(text: string): boolean {
  return /\b(pesquisei|pesquisamos|busquei|buscamos|google|pesquisa)\b/i.test(text)
}

function formatWhen(at: number): string | null {
  const diff = Date.now() - at
  if (diff < 60_000) return null
  if (diff < 3_600_000) return 'há pouco'
  if (diff < 86_400_000) return 'hoje mais cedo'
  if (diff < 172_800_000) return 'ontem'
  return 'em outro dia'
}

/** Honest recall — Qdrant (semântico) com fallback SQLite (cronológico). */
export async function buildRecallReply(excludeCurrentUserText?: string): Promise<string> {
  const topic = excludeCurrentUserText ? extractRecallTopic(excludeCurrentUserText) : null

  if (topic) {
    const hits = searchRecallTopicHits(topic, 6, excludeCurrentUserText)
    if (hits.length) {
      const unique = [...new Set(hits.map((h) => quoteTopic(h.content)))].slice(0, 3)
      return `Sim! Encontrei conversas sobre isso — você falou ${unique.join(', ')}. Quer continuar nisso?`
    }

    if (isQdrantEnabled()) {
      const semantic = await searchQdrant(topic, 8)
      const userHits = semantic.filter(
        (h) =>
          h.role === 'user' &&
          h.kind === 'turn' &&
          h.content.trim() !== excludeCurrentUserText?.trim()
      )
      if (userHits.length) {
        const unique = [...new Set(userHits.map((h) => quoteTopic(h.content)))].slice(0, 3)
        return `Sim! Lembro disso — você falou ${unique.join(', ')}. Quer continuar nisso?`
      }
    }

    return `Procurei no que guardamos e não achei nada sobre «${topic}». Quer me contar de novo?`
  }

  if (excludeCurrentUserText && isSearchRecallQuestion(excludeCurrentUserText)) {
    const searches = getRecentEvents('browser_search', 5)
    if (searches.length) {
      const queries = searches.map((e) => quoteTopic(e.payload.query ?? e.payload.q ?? '')).filter(Boolean)
      if (queries.length === 1) {
        return `Sim! Você pediu para pesquisar ${queries[0]}${formatWhen(searches[0].at) ? ` ${formatWhen(searches[0].at)}` : ''}. Quer outra busca?`
      }
      return `Sim! Suas buscas recentes: ${queries.slice(0, 3).join(', ')}. Quer repetir alguma?`
    }
  }

  const userTurns = getRecentUserMessages(20, excludeCurrentUserText)
  const older = excludeCurrentUserText ? wantsOlderRecall(excludeCurrentUserText) : false
  let topics = collectRecallTopics(excludeCurrentUserText, older ? 'older' : 'recent')

  if (topics.length < 2 && isQdrantEnabled() && excludeCurrentUserText) {
    const semantic = await searchQdrant(excludeCurrentUserText, 8)
    for (const hit of semantic) {
      if (
        hit.role === 'user' &&
        hit.kind === 'turn' &&
        hit.content.trim() !== excludeCurrentUserText.trim() &&
        !isMetaUserTurn(hit.content)
      ) {
        topics.push(quoteTopic(hit.content))
      }
    }
    topics = [...new Set(topics)].slice(0, 4)
  }

  if (topics.length) {
    const anchor = userTurns.find((t) => !isMetaUserTurn(t.content))
    const when = anchor ? formatWhen(anchor.at) : null
    const suffix = when ? ` (${when})` : ''
    const list = formatTopicList(topics)

    if (older) {
      return `Mais atrás a gente falou sobre ${list}${suffix}. Quer retomar algum desses assuntos?`
    }
    return `Sim! Entre outras coisas: ${list}${suffix}. Quer continuar algum deles?`
  }

  if (!userTurns.length) {
    const inSession = getRecentTranscript(20).filter(
      (t) =>
        t.role === 'user' &&
        (!excludeCurrentUserText || t.content.trim() !== excludeCurrentUserText.trim())
    )
    if (!inSession.length) {
      return 'Ainda estamos no comecinho — quase não conversamos! Me diz o que você quer falar agora.'
    }
    const last = inSession.slice(-3).map((t) => quoteTopic(t.content))
    if (last.length === 1) {
      return `Sim! Você tinha falado sobre ${last[0]}. Quer continuar nisso?`
    }
    return `Sim! Antes você falou sobre ${last.slice(0, -1).join(', ')} e também ${last[last.length - 1]}. Quer continuar nisso?`
  }

  return 'Ainda não achei assuntos guardados além desta conversa recente — me conta o que quer retomar?'
}
