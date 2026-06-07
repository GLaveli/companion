/** Matches common misspellings of “google” (ggolge, gogle, etc.). */
const GOOGLE =
  '(?:google|gogle|ggolge|ggogle|googel|gogl[eé]|g{1,2}[o0]{1,2}g{0,2}le)'

const BROWSER_DEST = `(?:${GOOGLE}|navegador|browser|internet)`

function normalize(text: string): string {
  return text.trim().toLowerCase()
}

function isGreeting(text: string): boolean {
  return /^(oi|olá|ola|hey|eii|bom dia|boa tarde|boa noite|tudo bem|obrigad)/.test(text)
}

/** User wants Lotus to open the browser / Google — not to answer from search. */
export function wantsBrowserSearch(text: string): boolean {
  const t = normalize(text)
  if (t.length < 6) return false

  if (new RegExp(`\\b(?:no|na|em)\\s+${BROWSER_DEST}\\b`, 'i').test(t)) return true
  if (/\b(?:abre|abrir)\s+(?:o\s+)?(?:google|navegador|browser)\b/i.test(t)) return true
  if (
    new RegExp(
      `\\b(?:pesquis[ae]|busca(?:r)?|procura(?:r)?)\\s+(?:no|na|em)\\s+${BROWSER_DEST}\\b`,
      'i'
    ).test(t)
  ) {
    return true
  }

  if (new RegExp(`\\b(?:pesquis[ae]|busca(?:r)?|procura(?:r)?)\\s+${GOOGLE}\\b`, 'i').test(t)) {
    return true
  }

  const hasOpenBrowser =
    /\b(?:abre|abrir|open|inicia)\s+(?:o\s+)?(?:navegador|browser|chrome|safari|edge|firefox)\b/i.test(
      t
    )
  const hasSearchVerb = /\b(?:pesquis|busca|procura|digita|procure)\b/i.test(t)
  if (hasOpenBrowser && hasSearchVerb) return true

  return false
}

/** User wants Lotus to search the web and answer in chat (internal research). */
export function wantsAnswerResearch(text: string): boolean {
  const t = normalize(text)
  if (t.length < 10 || isGreeting(t)) return false

  // Explicit browser intent wins — handled by the agent, not research.
  if (wantsBrowserSearch(text)) return false

  if (/\b(?:pesquis[ae]|busca(?:r)?|procura(?:r)?)\s+(?:sobre|por|a respeito de)\b/i.test(t)) {
    return true
  }

  const signals = [
    /\b(novo|nova|novos|novas|último|ultimo|lançamento|lancamento|recente|atual|anunciado|saiu)\b/,
    /\b(o que acha|o que você acha|what do you think|sabe sobre|conhece|ouviu falar|me fala sobre|conta sobre|fala sobre)\b/,
    /\b(jogo|game|games|filme|série|serie|anime|notícia|noticia|trailer|review|resenha)\b/,
    /\b(god of war|playstation|xbox|nintendo|state of play)\b/
  ]

  return signals.some((re) => re.test(t))
}

function cleanQueryTail(raw: string): string {
  return raw
    .replace(/^(?:uma?|um|o|a|os|as)\s+/i, '')
    .replace(/\?+$/, '')
    .trim()
}

/** Clean query for opening Google in the browser. */
export function extractBrowserSearchQuery(text: string): string {
  const googleFirst = text.match(
    new RegExp(
      `\\b(?:pesquis[ae]|busca(?:r)?|procura(?:r)?)\\s+(?:no|na|em)\\s+${BROWSER_DEST}\\s+(?:por|sobre)?\\s*(.+)$`,
      'i'
    )
  )
  if (googleFirst?.[1]) {
    return cleanQueryTail(googleFirst[1])
  }

  let q = text.trim()

  q = q.replace(
    new RegExp(
      `^(?:por favor,?\\s*)?(?:pesquis[ae]|busca(?:r)?|procura(?:r)?)\\s+(?:no|na|em)\\s+${BROWSER_DEST}\\s*`,
      'i'
    ),
    ''
  )
  q = q.replace(
    /^(?:por favor,?\s*)?(?:pesquis[ae]|busca(?:r)?|procura(?:r)?)\s+/i,
    ''
  )
  q = q.replace(/^sobre\s+/i, '')
  q = q.replace(/^por\s+/i, '')

  q = q.replace(
    new RegExp(`\\s+(?:no|na|em)\\s+${BROWSER_DEST}\\s*$`, 'i'),
    ''
  )

  return cleanQueryTail(q)
}

/** Topic for internal web research (Lotus answers the user). */
export function extractResearchTopic(text: string): string {
  const t = text.trim()

  const researchAbout = t.match(
    /\b(?:pesquis[ae]|busca(?:r)?|procura(?:r)?)\s+(?:sobre|por|a respeito de)\s+(.+?)\??$/i
  )?.[1]
  if (researchAbout) return cleanQueryTail(researchAbout)

  if (/god of war/i.test(t)) {
    return 'God of War Laufey 2026 sinopse gameplay'
  }

  const about = t.match(
    /(?:o que acha do|o que você acha do|sabe sobre|me fala sobre|fala sobre|conhece o|conhece a)\s+(.+?)\??$/i
  )?.[1]
  if (about) return `${about.trim()} 2026 review`

  const novo = t.match(/(?:novo|nova)\s+(.+?)\??$/i)?.[1]
  if (novo) return `${novo.trim()} 2026`

  return t.replace(/\?+$/, '').trim()
}

/** Quick check — skip the LLM agent planner for normal conversation. */
export function mightNeedAgentAction(text: string): boolean {
  const t = normalize(text)
  if (t.length < 6 || isGreeting(t)) return false

  if (wantsBrowserSearch(text)) return true

  if (/https?:\/\/[^\s]+/i.test(text) && /\b(abre|abrir|open|vai para|acessa|acesse|mostra)\b/i.test(t)) {
    return true
  }

  if (
    /\b(?:abre|abrir|open|inicia|iniciar|launch)\s+(?:o\s+)?(?:navegador|browser|chrome|safari|edge|firefox|google)\b/i.test(
      t
    )
  ) {
    return true
  }

  if (/\b(?:abre|abrir|open|inicia|iniciar|launch)\s+(?:o|a|meu|minha)\s+\S/i.test(t)) {
    return true
  }

  return false
}
