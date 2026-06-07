import type { AssistantReply } from '../../../shared/types'
import { markGreeted, wasGreeted } from './sessionMemory'

export function isStopCommand(text: string): boolean {
  const t = text.trim().toLowerCase()
  return /^(chega|para|pare|stop|basta|sil[eê]ncio|cala|calma|enough|tchau|bye|sai)\.?!?$/i.test(t)
}

export function isSimpleGreeting(text: string): boolean {
  const t = text.trim()
  return /^(oi+|olá|ola|hey|eii+|bom dia|boa tarde|boa noite|tudo bem|e aí|eai)[!.?\s]*$/i.test(t)
}

const GREETING_FIRST = [
  'Oii! Sou a Lotus — bora conversar?',
  'Eiii! Tô aqui, pode falar.',
  'Opa! Lotus na área — manda ver.'
]

const GREETING_AGAIN = [
  'Eiii, de novo oi? Tô aqui sim — fala o que você quer!',
  'Opa, já tinha te respondido! Me conta o que precisa.',
  'Oi oi! Ainda tô aqui — manda a pergunta.',
  'Haha, oi de novo! Bora, o que manda?'
]

function pick(pool: string[]): string {
  return pool[Math.floor(Math.random() * pool.length)]
}

export function stopReply(): AssistantReply {
  return {
    text: pick([
      'Beleza, paro por aqui! Quando quiser, é só chamar.',
      'Ok ok, fico quietinha. Me chama quando precisar!',
      'Entendi — paro agora. Até a próxima!'
    ]),
    emotion: 'neutral'
  }
}

export function greetingReply(): AssistantReply {
  const again = wasGreeted()
  markGreeted()
  return {
    text: pick(again ? GREETING_AGAIN : GREETING_FIRST),
    emotion: 'happy'
  }
}

/** Fast path — no LLM, avoids robotic repetition. */
export function tryConversationShortcut(text: string): AssistantReply | null {
  if (isStopCommand(text)) return stopReply()
  if (isSimpleGreeting(text)) return greetingReply()
  return null
}
