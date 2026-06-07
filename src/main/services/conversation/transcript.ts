import {
  extractRecallTopic,
  getRecentEvents,
  getRecentUserMessages,
  persistTurn,
  searchTurns
} from '../memory'
import { indexMemoryPoint, isQdrantEnabled, searchQdrant } from '../memory/qdrant'

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

  try {
    const saved = persistTurn(role, trimmed)
    void indexMemoryPoint({
      id: saved.id,
      role,
      content: trimmed,
      at: saved.at,
      sessionId: saved.sessionId,
      kind: 'turn'
    })
  } catch (err) {
    console.warn('[transcript] persist failed:', (err as Error).message)
  }
}

export function getRecentTranscript(count = 10): TranscriptTurn[] {
  return turns.slice(-count)
}

export function resetTranscript(): void {
  turns.length = 0
}

export function formatTranscriptForPrompt(maxTurns = 8): string {
  const recent = getRecentTranscript(maxTurns)
  if (recent.length <= 1) return ''

  return (
    'Histórico REAL desta sessão (use só isso — nunca invente conversas):\n' +
    recent.map((t) => `${t.role === 'user' ? 'Usuário' : 'Lotus'}: ${t.content}`).join('\n')
  )
}

function quoteTopic(text: string): string {
  const t = text.trim()
  if (t.length <= 72) return `«${t}»`
  return `«${t.slice(0, 69)}…»`
}

export function isRecallQuestion(text: string): boolean {
  const t = text.trim().toLowerCase()
  return /\b(lembra|lembrar|lembro|memória|memoria|última conversa|ultima conversa|conversa anterior|falamos sobre|falava sobre|estávamos falando|estavamos falando|do que (?:a gente |nós |nos )?fal|nossa conversa|o que (?:a gente |nós |nos )?convers|retoma|continuar de onde|pesquisei|pesquisamos|busquei|buscamos)\b/i.test(
    t
  )
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

    const hits = searchTurns(topic, 6).filter(
      (h) => h.role === 'user' && h.content.trim() !== excludeCurrentUserText?.trim()
    )
    if (hits.length) {
      const unique = [...new Set(hits.map((h) => quoteTopic(h.content)))].slice(0, 3)
      return `Sim! Encontrei conversas sobre isso — você falou ${unique.join(', ')}. Quer continuar nisso?`
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

  const last = userTurns.slice(0, 3).map((t) => quoteTopic(t.content))
  const when = userTurns[0] ? formatWhen(userTurns[0].at) : null
  const suffix = when ? ` (${when})` : ''

  if (last.length === 1) {
    return `Sim! Você tinha falado sobre ${last[0]}${suffix}. Quer continuar nisso?`
  }

  return `Sim! Antes você falou sobre ${last.slice(0, -1).join(', ')} e também ${last[last.length - 1]}${suffix}. Quer continuar nisso?`
}
