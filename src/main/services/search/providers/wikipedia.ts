import type { SearchHit } from '../types'

type WikiSearchResponse = {
  query?: { search?: Array<{ title: string; snippet: string; pageid: number }> }
}

const WIKI_LANGS = ['en', 'pt'] as const

function stripWiki(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

export async function searchWikipedia(query: string, maxResults: number): Promise<SearchHit[]> {
  const hits: SearchHit[] = []

  for (const lang of WIKI_LANGS) {
    if (hits.length >= maxResults) break
    try {
      const url = new URL(`https://${lang}.wikipedia.org/w/api.php`)
      url.searchParams.set('action', 'query')
      url.searchParams.set('list', 'search')
      url.searchParams.set('srsearch', query)
      url.searchParams.set('srlimit', String(maxResults))
      url.searchParams.set('format', 'json')
      url.searchParams.set('utf8', '1')

      const res = await fetch(url, { signal: AbortSignal.timeout(8_000) })
      if (!res.ok) continue

      const data = (await res.json()) as WikiSearchResponse
      for (const item of data.query?.search ?? []) {
        if (hits.length >= maxResults) break
        const pageUrl = `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`
        hits.push({
          title: `${item.title} (Wikipedia ${lang.toUpperCase()})`,
          snippet: stripWiki(item.snippet),
          url: pageUrl
        })
      }
    } catch {
      /* try next language */
    }
  }

  return hits
}
