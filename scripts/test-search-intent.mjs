/**
 * Sanity check for browser vs answer search intent.
 * Run: node scripts/test-search-intent.mjs
 */

const GOOGLE = '(?:google|gogle|ggolge|ggogle|googel|gogl[eé]|g{1,2}[o0]{1,2}g{0,2}le)'
const BROWSER_DEST = `(?:${GOOGLE}|navegador|browser|internet)`

function wantsBrowserSearch(text) {
  const t = text.trim().toLowerCase()
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
  return false
}

function wantsAnswerResearch(text) {
  const t = text.trim().toLowerCase()
  if (t.length < 10) return false
  if (wantsBrowserSearch(text)) return false
  if (/\b(?:pesquis[ae]|busca(?:r)?|procura(?:r)?)\s+(?:sobre|por|a respeito de)\b/i.test(t)) {
    return true
  }
  return /\b(god of war|jogo|game)\b/i.test(t)
}

function extractBrowserSearchQuery(text) {
  const googleFirst = text.match(
    new RegExp(
      `\\b(?:pesquis[ae]|busca(?:r)?|procura(?:r)?)\\s+(?:no|na|em)\\s+${BROWSER_DEST}\\s+(?:por|sobre)?\\s*(.+)$`,
      'i'
    )
  )
  if (googleFirst?.[1]) {
    return googleFirst[1]
      .replace(/^(?:uma?|um|o|a|os|as)\s+/i, '')
      .replace(/\?+$/, '')
      .trim()
  }

  let q = text.trim()
  q = q.replace(/^(?:por favor,?\s*)?(?:pesquis[ae]|busca(?:r)?|procura(?:r)?)\s+/i, '')
  q = q.replace(/^sobre\s+/i, '')
  q = q.replace(new RegExp(`\\s+(?:no|na|em)\\s+${BROWSER_DEST}\\s*$`, 'i'), '')
  return q
    .replace(/^(?:uma?|um|o|a|os|as)\s+/i, '')
    .replace(/\?+$/, '')
    .trim()
}

const cases = [
  {
    text: 'Pesquisa sobre uma receita de bolo no google',
    browser: true,
    answer: false,
    query: 'receita de bolo'
  },
  {
    text: 'Pesquise sobre o god of war no ggolge',
    browser: true,
    answer: false,
    query: 'god of war'
  },
  { text: 'Pesquise sobre god of war', browser: false, answer: true },
  { text: 'busca no google receita de bolo', browser: true, answer: false, query: 'receita de bolo' }
]

let failed = 0
for (const c of cases) {
  const b = wantsBrowserSearch(c.text)
  const a = wantsAnswerResearch(c.text)
  const q = c.query ? extractBrowserSearchQuery(c.text) : null
  const ok = b === c.browser && a === c.answer && (c.query == null || q === c.query)
  if (!ok) {
    failed++
    console.error('FAIL', c.text, { b, a, q })
  } else {
    console.log('OK', c.text, q ? `→ "${q}"` : '')
  }
}

process.exit(failed ? 1 : 0)
