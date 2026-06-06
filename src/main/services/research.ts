/** Detects questions that need live web data (games, news, opinions on recent releases). */
export function needsWebResearch(text: string): boolean {
  const t = text.trim().toLowerCase()
  if (t.length < 10) return false
  if (/^(oi|olá|ola|hey|eii|bom dia|boa tarde|boa noite|tudo bem|obrigad)/.test(t)) return false

  const signals = [
    /\b(novo|nova|novos|novas|último|ultimo|lançamento|lancamento|recente|atual|anunciado|saiu)\b/,
    /\b(o que acha|o que você acha|what do you think|sabe sobre|conhece|ouviu falar|me fala sobre|conta sobre|fala sobre)\b/,
    /\b(jogo|game|games|filme|série|serie|anime|notícia|noticia|trailer|review|resenha)\b/,
    /\b(god of war|playstation|xbox|nintendo|state of play)\b/
  ]

  return signals.some((re) => re.test(t))
}

/** Short honest line spoken while search runs in the background. */
export function buildResearchAck(userText: string): string {
  if (/god of war/i.test(userText)) {
    return 'Hmm, eu ainda não vi esse God of War novo! Deixa eu pesquisar rapidinho...'
  }
  if (/jogo|game/i.test(userText)) {
    return 'Opa, ainda não joguei esse! Vou dar uma olhada na internet agora...'
  }
  if (/filme|série|serie|anime/i.test(userText)) {
    return 'Ah, ainda não vi esse! Me dá um segundinho que vou pesquisar...'
  }
  return 'Hmm, eu ainda não sei direito! Deixa eu pesquisar um pouquinho...'
}

/** Builds a search query from casual Portuguese questions. */
export function buildSearchQuery(userText: string): string {
  const t = userText.trim()

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

export function formatSearchBlock(
  hits: Array<{ title: string; snippet: string; url: string }>
): string {
  if (!hits.length) return 'Nenhum resultado encontrado.'
  return hits
    .map((h, i) => `[${i + 1}] ${h.title}\n${h.snippet || '(sem resumo)'}\nURL: ${h.url}`)
    .join('\n\n')
}
