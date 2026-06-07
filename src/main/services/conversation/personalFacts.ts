import type { AssistantReply } from '../../../shared/types'
import { getRecentUserMessages } from '../memory'
import { getCachedUserName, setCachedUserName } from './sessionMemory'
import { getRecentTranscript } from './transcript'

const NAME_INTRO =
  /(?:meu nome (?:é|e)|me chamo|pode me chamar de|pode chamar de|sou o|sou a)\s+(.+)/i

const NAME_QUESTION =
  /(?:qual|como)\s+(?:é|e)\s+(?:o\s+)?meu\s+nome|como\s+(?:me\s+)?chamo|sabe\s+meu\s+nome|lembra\s+(?:do\s+)?meu\s+nome/i

function normalizeName(raw: string): string | null {
  const name = raw
    .replace(/[.!?,;:]+$/g, '')
    .trim()
    .split(/\s+/)[0]
  if (!name || name.length < 2 || name.length > 32) return null
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
}

function parseNameFromIntro(text: string): string | null {
  const match = text.trim().match(NAME_INTRO)
  if (!match?.[1]) return null
  return normalizeName(match[1])
}

function findNameInTranscript(excludeContent?: string): string | null {
  const exclude = excludeContent?.trim()

  for (const turn of [...getRecentTranscript(40)].reverse()) {
    if (turn.role !== 'user') continue
    if (exclude && turn.content.trim() === exclude) continue
    const name = parseNameFromIntro(turn.content)
    if (name) return name
  }

  return null
}

function findNameInDb(excludeContent?: string): string | null {
  for (const turn of getRecentUserMessages(40, excludeContent)) {
    const name = parseNameFromIntro(turn.content)
    if (name) return name
  }
  return null
}

function resolveStoredUserName(excludeContent?: string): string | null {
  const cached = getCachedUserName()
  if (cached !== undefined) return cached

  const fromRam = findNameInTranscript(excludeContent)
  if (fromRam) {
    setCachedUserName(fromRam)
    return fromRam
  }

  const fromDb = findNameInDb(excludeContent)
  setCachedUserName(fromDb)
  return fromDb
}

/** Respostas curtas sobre nome — sem LLM, sem puxar tópicos antigos. */
export function tryPersonalFactShortcut(text: string): AssistantReply | null {
  const introName = parseNameFromIntro(text)
  if (introName) {
    setCachedUserName(introName)
    return {
      text: `Prazer, ${introName}!`,
      emotion: 'happy'
    }
  }

  if (!NAME_QUESTION.test(text.trim())) return null

  const name = resolveStoredUserName(text)
  if (name) {
    return {
      text: `Seu nome é ${name}.`,
      emotion: 'happy'
    }
  }

  return {
    text: 'Ainda não me disse seu nome — como posso te chamar?',
    emotion: 'thinking'
  }
}
