import { extractResearchTopic, wantsAnswerResearch } from './intent'
import { buildResearchSearchQuery } from './research/queryBuilder'

/** Detects when Lotus should search the web and answer — not open the browser. */
export function needsWebResearch(text: string): boolean {
  return wantsAnswerResearch(text)
}

/** Short honest line spoken while search runs in the background. */
export function buildResearchAck(userText: string): string {
  if (/\b(?:pesquis[ae]|busca(?:r)?|procura(?:r)?)\s+(?:sobre|por)\b/i.test(userText)) {
    return 'Beleza, deixa eu pesquisar isso e te conto o que eu achar!'
  }
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
  const topic = extractResearchTopic(userText)
  return buildResearchSearchQuery(userText, topic)
}

export function formatSearchBlock(
  hits: Array<{ title: string; snippet: string; url: string }>
): string {
  if (!hits.length) return 'Nenhum resultado encontrado.'
  return hits
    .map((h, i) => `[${i + 1}] ${h.title}\n${h.snippet || '(sem resumo)'}\nURL: ${h.url}`)
    .join('\n\n')
}
