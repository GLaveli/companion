import type { SearchHit } from '../types'

type OpenSearchResponse = [string, string[], string[], string[]]

const WIKI_LANGS = ['pt', 'en'] as const

export async function searchWikipedia(query: string, maxResults: number): Promise<SearchHit[]> {
  const hits: SearchHit[] = []

  for (const lang of WIKI_LANGS) {
    if (hits.length >= maxResults) break
    try {
      const url = new URL(`https://${lang}.wikipedia.org/w/api.php`)
      url.searchParams.set('action', 'opensearch')
      url.searchParams.set('search', query)
      url.searchParams.set('limit', String(maxResults))
      url.searchParams.set('namespace', '0')
      url.searchParams.set('format', 'json')

      const res = await fetch(url, { signal: AbortSignal.timeout(8_000) })
      if (!res.ok) continue

      const [, titles, descriptions, urls] = (await res.json()) as OpenSearchResponse
      for (let i = 0; i < titles.length && hits.length < maxResults; i++) {
        if (!titles[i] || !urls[i]) continue
        hits.push({
          title: `${titles[i]} (Wikipedia ${lang.toUpperCase()})`,
          snippet: descriptions[i] || 'Artigo da Wikipedia.',
          url: urls[i]
        })
      }
    } catch {
      /* try next language */
    }
  }

  return hits
}
