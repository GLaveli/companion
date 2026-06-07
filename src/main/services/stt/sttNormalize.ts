/**
 * Corrige erros frequentes do Whisper em português (comandos e frases de nome).
 */
const OPEN_VERB = /\b(?:abre|abrir|abdo|abdi|abri)\b/i

const BROWSER_GARBLE =
  /\b(?:pegador|regadura|negador|navedador|navegado|nevagador|navegador|browser|internet)\b/i

const BROWSER_GARBLE_REPLACE =
  /(?:abre|abrir|abdo|abdi|abri)\s+(?:o\s+|a\s+|na\s+|no\s+)?(?:pegador|regadura|negador|navedador|navegado|nevagador)\b/gi

export interface SttNormalizeContext {
  /** Nome que o usuário rejeitou («meu nome não é X»). */
  rejectedName?: string | null
  /** Nome já conhecido da sessão. */
  knownName?: string | null
}

export function normalizeSttText(text: string, context?: SttNormalizeContext): string {
  let t = text.trim()
  if (!t) return t

  t = t.replace(/\babdi\b/gi, 'abrir')
  t = t.replace(/\babdo\b/gi, 'abrir')

  if (OPEN_VERB.test(t) && BROWSER_GARBLE.test(t)) {
    t = t.replace(BROWSER_GARBLE_REPLACE, 'abrir o navegador')
    if (OPEN_VERB.test(t) && /pegador|regadura|negador|navedador|nevagador/i.test(t)) {
      t = 'abrir o navegador'
    }
  }

  t = fixNameCorrectionGarble(t, context)

  return t.replace(/\s+/g, ' ').trim()
}

/** STT confundiu «navegador» com outra palavra após «abrir». */
export function looksLikeOpenBrowserGarble(text: string): boolean {
  const t = text.trim().toLowerCase()
  if (!OPEN_VERB.test(t)) return false
  if (/\b(?:navegador|browser|chrome|safari|firefox|edge)\b/.test(t)) return true
  return BROWSER_GARBLE.test(t)
}

function fixNameCorrectionGarble(t: string, context?: SttNormalizeContext): string {
  const looksLikeNameTalk =
    /\bmano\b/i.test(t) ||
    /\bmeu\s+nome\b/i.test(t) ||
    (/\bn[aã]o\s+[eé]\b/i.test(t) && /\beu\s+(?:sou|ia)\b/i.test(t))

  if (!looksLikeNameTalk) return t

  let out = t

  // «Mano» ≈ «Meu nome»
  out = out.replace(/\bmano,?\s*/gi, 'meu nome ')

  // «não é o eu» ≈ «não é Will» (nome rejeitado)
  if (context?.rejectedName) {
    out = out.replace(
      /\bn[aã]o\s+[eé]\s+o\s+eu\b/gi,
      `não é ${context.rejectedName}`
    )
  } else {
    out = out.replace(/\bn[aã]o\s+[eé]\s+o\s+eu\b/gi, 'não é')
  }

  // «eu ia em mim» ≈ «eu sou Guilherme»
  if (context?.knownName) {
    out = out.replace(/\beu\s+ia\s+em\s+mim\b/gi, `eu sou ${context.knownName}`)
  } else {
    out = out.replace(/\beu\s+ia\s+em\s+mim\b/gi, 'eu sou')
  }

  out = out.replace(/\beu\s+ia\b/gi, 'eu sou')

  return out
}
