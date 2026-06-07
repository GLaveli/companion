import { getRecentUserMessages } from '../memory'
import { getCachedUserName, setCachedUserName } from './sessionMemory'
import { getRecentTranscript } from './transcript'

function normalizeName(raw: string): string | null {
  const name = raw
    .replace(/[.!?,;:]+$/g, '')
    .trim()
    .split(/\s+/)[0]
  if (!name || name.length < 2 || name.length > 32) return null
  if (/^(?:nao|não|nao|sim|e|é|o|a)$/i.test(name)) return null
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
}

function extractRejectedNameFromText(text: string): string | null {
  const match = text.match(/meu\s+nome\s+(?:nao|não)\s+(?:é|e)\s+(\S+)/i)
  if (!match?.[1]) return null
  return normalizeName(match[1])
}

/** Extrai nome declarado ou corrigido — mais recente na conversa prevalece. */
export function extractUserNameFromText(text: string): string | null {
  const t = text.trim()

  const correction = t.match(
    /meu\s+nome\s+(?:nao|não)\s+(?:é|e)\s+\S+(?:\s+(?:e|é)\s+sim)\s+([^\s,!.?]+)/i
  )
  if (correction?.[1]) return normalizeName(correction[1])

  const correctionChain = t.match(
    /meu\s+nome\s+(?:nao|não)\s+(?:é|e)\s+\S+,?\s*eu\s+sou\s+([^\s,!.?]+)/i
  )
  if (correctionChain?.[1]) return normalizeName(correctionChain[1])

  const euSou = t.match(/\beu\s+sou\s+([^\s,!.?]+)/i)
  if (euSou?.[1]) return normalizeName(euSou[1])

  const actually = t.match(
    /(?:na\s+verdade|corrige(?:ndo)?|desculp\w*)\s*,?\s*(?:é|e|sou)\s+([^\s,!.?]+)/i
  )
  if (actually?.[1]) return normalizeName(actually[1])

  const intro = t.match(
    /(?:meu\s+nome\s+(?:é|e)|me\s+chamo|pode\s+me\s+chamar\s+de|pode\s+chamar\s+de|sou\s+(?:o|a))\s+([^\s,!.?]+)/i
  )
  if (intro?.[1]) return normalizeName(intro[1])

  return null
}

function findNameInTranscript(
  excludeContent: string | undefined,
  pick: 'current' | 'previous'
): string | null {
  const exclude = excludeContent?.trim()

  for (const turn of [...getRecentTranscript(40)].reverse()) {
    if (turn.role !== 'user') continue
    if (exclude && turn.content.trim() === exclude) continue

    if (pick === 'previous') {
      const rejected = extractRejectedNameFromText(turn.content)
      if (rejected) return rejected
      continue
    }

    const name = extractUserNameFromText(turn.content)
    if (name) return name
  }

  return null
}

function findNameInDb(excludeContent: string | undefined, pick: 'current' | 'previous'): string | null {
  for (const turn of getRecentUserMessages(40, excludeContent)) {
    if (pick === 'previous') {
      const rejected = extractRejectedNameFromText(turn.content)
      if (rejected) return rejected
      continue
    }

    const name = extractUserNameFromText(turn.content)
    if (name) return name
  }
  return null
}

export function resolveCurrentUserName(excludeContent?: string): string | null {
  const fromRam = findNameInTranscript(excludeContent, 'current')
  if (fromRam) {
    setCachedUserName(fromRam)
    return fromRam
  }

  const fromDb = findNameInDb(excludeContent, 'current')
  if (fromDb) {
    setCachedUserName(fromDb)
    return fromDb
  }

  const cached = getCachedUserName()
  return cached !== undefined ? cached : null
}

export function resolvePreviousUserName(excludeContent?: string): string | null {
  return findNameInTranscript(excludeContent, 'previous') ?? findNameInDb(excludeContent, 'previous')
}

/** Regras fixas — sempre no prompt do chat (eu = usuário, ela = Lotus). */
export function formatIdentityRulesForPrompt(): string {
  return `QUEM É QUEM:
- Lotus = VOCÊ (personagem). Perguntas sobre «seu nome», «quem é você» → você é a Lotus.
- Usuário = a pessoa no chat. «Meu nome», «como me chamo» → fale do USUÁRIO, nunca diga Lotus.
- Se não souber o nome do usuário, diga que ele ainda não te disse — não invente.`
}

/** Fatos do usuário já declarados (nome etc.). */
export function formatUserFactsForPrompt(): string | null {
  const current = resolveCurrentUserName()
  const previous = resolvePreviousUserName()
  if (!current && !previous) return null

  const lines = ['Fatos do usuário (confiáveis):']
  if (current) lines.push(`- Nome dele: ${current}`)
  if (previous) lines.push(`- Nome antigo que ele corrigiu: ${previous}`)
  return lines.join('\n')
}

/** Grava fatos do usuário (nome etc.) para o prompt — sem resposta pronta; o LLM interpreta a mensagem. */
export function cachePersonalFactsFromText(text: string): void {
  const declaredName = extractUserNameFromText(text)
  if (declaredName) setCachedUserName(declaredName)
}
