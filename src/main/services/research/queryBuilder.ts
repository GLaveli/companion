/** Maps typos / pt-BR names to strong English search queries. */
const TOPIC_ALIASES: Record<string, string> = {
  'stelar blade': 'Stellar Blade PS5 game review',
  'stellar blade': 'Stellar Blade PS5 game review',
  'stelar': 'Stellar Blade PS5 game',
  'god of war': 'God of War Laufey 2026 PS5',
  'god of war laufey': 'God of War Laufey 2026 PS5 State of Play'
}

function normalizeKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Builds a web search query from the user's research topic. */
export function buildResearchSearchQuery(userText: string, topic: string): string {
  const key = normalizeKey(topic)

  if (TOPIC_ALIASES[key]) return TOPIC_ALIASES[key]

  if (/stel\w*\s*blade/i.test(topic)) {
    return 'Stellar Blade PS5 action game review'
  }

  if (/god\s*of\s*war/i.test(topic)) {
    return 'God of War Laufey 2026 PS5'
  }

  // Short proper-noun topics (games, films) — search in English for better hits.
  if (/^[a-z0-9\s'-]{2,48}$/i.test(topic) && topic.split(/\s+/).length <= 5) {
    const looksLikeGame =
      /jogo|game|ps5|xbox|nintendo|steam|blade|war|final fantasy|zelda/i.test(userText) ||
      /^[A-Z][a-z]+(\s+[A-Z][a-z]+)+/.test(topic)

    if (looksLikeGame || /\b(?:jogo|game|filme|série|anime)\b/i.test(userText)) {
      return `${topic.trim()} review game OR movie`
    }
  }

  return topic.replace(/\?+$/, '').trim()
}

/** One-line hint injected into the research synthesis prompt. */
export function researchTopicHint(userText: string, topic: string): string {
  if (/stel\w*\s*blade/i.test(userText + topic)) {
    return 'O usuário perguntou sobre STELLAR BLADE (jogo PS5 da Shift Up). NÃO confunda com Parov Stelar (música) nem invente "Star Blade".'
  }
  return `Foque EXCLUSIVAMENTE no assunto pedido: "${topic}". Ignore resultados irrelevantes com nomes parecidos.`
}
