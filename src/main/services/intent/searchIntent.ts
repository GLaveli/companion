/** Matches common misspellings of “google” (ggolge, gogle, etc.). */
const GOOGLE =
  '(?:google|gogle|ggolge|ggogle|googel|gogl[eé]|g{1,2}[o0]{1,2}g{0,2}le)'

const BROWSER_DEST = `(?:${GOOGLE}|navegador|browser|internet)`
const BROWSER_APP = `(?:navegador|browser|chrome|safari|edge|firefox|${GOOGLE})`

const OPEN_BROWSER_RE =
  /\b(?:abre|abrir|open|inicia|iniciar|launch)\s+(?:o\s+)?(?:navegador|browser|chrome|safari|edge|firefox)\b/i

const OPEN_GOOGLE_RE = /\b(?:abre|abrir|open|inicia)\s+(?:o\s+)?(?:google|gogle|ggolge)\b/i

const SEARCH_VERB_RE = /\b(?:pesquis[ae]|busca(?:r)?|procura(?:r)?|digita|procure)\b/i

const SLANG_FILLER =
  /^(?:ai|a[ií]|pa|pra|para|pro|noix|nois|n[oó]s|nos|a gente|por favor|please|vlw|valeu|blz|beleza)(?:\s+(?:ai|a[ií]|pa|pra|para|noix|nois|n[oó]s|nos|a gente|por favor))*$/i

function normalize(text: string): string {
  return text.trim().toLowerCase()
}

function isGreeting(text: string): boolean {
  return /^(oi|olá|ola|hey|eii|bom dia|boa tarde|boa noite|tudo bem|obrigad)/.test(text)
}

function cleanQueryTail(raw: string): string {
  return raw
    .replace(/^(?:uma?|um|o|a|os|as)\s+/i, '')
    .replace(/\?+$/, '')
    .trim()
}

function stripOpenBrowserLead(text: string): string {
  let q = text.trim()

  q = q.replace(
    /^(?:por favor,?\s*)?(?:abre|abrir|open|inicia|iniciar|launch)\s+(?:o\s+)?(?:navegador|browser|chrome|safari|edge|firefox|google|gogle|ggolge)\s*/i,
    ''
  )
  q = q.replace(/^(?:ai|a[ií]|pa|pra|para|pro|noix|nois|n[oó]s|nos|a gente)\s+/gi, '')
  q = q.replace(/^(?:ai|a[ií]|pa|pra|para|pro|noix|nois|n[oó]s|nos|a gente)\s+/gi, '')

  return cleanQueryTail(q)
}

/** Query is a real search topic — not “abre o navegador” or slang filler. */
export function isMeaningfulSearchQuery(query: string, originalText?: string): boolean {
  const q = query.trim()
  if (q.length < 2) return false

  const nq = normalize(q)

  if (OPEN_BROWSER_RE.test(nq) || OPEN_GOOGLE_RE.test(nq)) return false
  if (new RegExp(`^${BROWSER_APP}$`, 'i').test(nq)) return false
  if (SLANG_FILLER.test(nq)) return false

  const stripped = stripOpenBrowserLead(q)
  if (stripped.length < 2) return false
  if (SLANG_FILLER.test(normalize(stripped))) return false
  if (new RegExp(`^${BROWSER_APP}$`, 'i').test(normalize(stripped))) return false

  if (originalText) {
    const remainder = stripOpenBrowserLead(originalText)
    if (!remainder || remainder.length < 2) return false
    if (SLANG_FILLER.test(normalize(remainder))) return false
  }

  return true
}

/** User wants to open Google homepage or the browser app — no search terms. */
export function wantsOpenBrowserOnly(text: string): boolean {
  const t = normalize(text)
  if (t.length < 6 || isGreeting(t)) return false

  const opensBrowser = OPEN_BROWSER_RE.test(t) || OPEN_GOOGLE_RE.test(t)
  if (!opensBrowser) return false

  if (wantsBrowserSearch(text)) return false

  return true
}

export function wantsOpenGoogleHome(text: string): boolean {
  return OPEN_GOOGLE_RE.test(normalize(text)) && !wantsBrowserSearch(text)
}

/** Which browser/app to launch for open-only commands. */
export function extractBrowserAppName(text: string): string {
  const t = normalize(text)
  if (/\bchrome\b/.test(t)) return 'chrome'
  if (/\bsafari\b/.test(t)) return 'safari'
  if (/\bfirefox\b/.test(t)) return 'firefox'
  if (/\bedge\b/.test(t)) return 'edge'
  if (OPEN_GOOGLE_RE.test(t)) return 'navegador'
  return 'navegador'
}

/** User wants a Google search in the browser — must include a real search topic. */
export function wantsBrowserSearch(text: string): boolean {
  const t = normalize(text)
  if (t.length < 6) return false

  if (
    new RegExp(
      `\\b(?:pesquis[ae]|busca(?:r)?|procura(?:r)?)\\s+(?:no|na|em)\\s+${BROWSER_DEST}\\b`,
      'i'
    ).test(t)
  ) {
    return isMeaningfulSearchQuery(extractBrowserSearchQuery(text), text)
  }

  if (new RegExp(`\\b(?:pesquis[ae]|busca(?:r)?|procura(?:r)?)\\s+${GOOGLE}\\b`, 'i').test(t)) {
    return isMeaningfulSearchQuery(extractBrowserSearchQuery(text), text)
  }

  if (new RegExp(`\\b(?:no|na|em)\\s+${BROWSER_DEST}\\b`, 'i').test(t) && SEARCH_VERB_RE.test(t)) {
    return isMeaningfulSearchQuery(extractBrowserSearchQuery(text), text)
  }

  const hasOpenBrowser = OPEN_BROWSER_RE.test(t) || OPEN_GOOGLE_RE.test(t)
  if (hasOpenBrowser && SEARCH_VERB_RE.test(t)) {
    return isMeaningfulSearchQuery(extractBrowserSearchQuery(text), text)
  }

  return false
}

/** User wants Lotus to search the web and answer in chat (internal research). */
export function wantsAnswerResearch(text: string): boolean {
  const t = normalize(text)
  if (t.length < 10 || isGreeting(t)) return false

  if (wantsBrowserSearch(text) || wantsOpenBrowserOnly(text)) return false

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
  q = q.replace(/^(?:por favor,?\s*)?(?:pesquis[ae]|busca(?:r)?|procura(?:r)?)\s+/i, '')
  q = q.replace(/^sobre\s+/i, '')
  q = q.replace(/^por\s+/i, '')

  q = q.replace(new RegExp(`\\s+(?:no|na|em)\\s+${BROWSER_DEST}\\s*$`, 'i'), '')

  q = stripOpenBrowserLead(q)

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

  if (wantsBrowserSearch(text) || wantsOpenBrowserOnly(text)) return true

  if (/https?:\/\/[^\s]+/i.test(text) && /\b(abre|abrir|open|vai para|acessa|acesse|mostra)\b/i.test(t)) {
    return true
  }

  if (OPEN_BROWSER_RE.test(t) || OPEN_GOOGLE_RE.test(t)) return true

  if (/\b(?:abre|abrir|open|inicia|iniciar|launch)\s+(?:o|a|meu|minha)\s+\S/i.test(t)) {
    return true
  }

  return false
}
