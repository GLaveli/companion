import type { SearchHit } from '../types'

/** Public SearXNG instances (no API key). Tried in order until one responds. */
const SEARX_INSTANCES = [
  'https://searx.be',
  'https://search.mdosch.de',
  'https://opnxng.com',
  'https://paulgo.io'
]

type SearxResponse = {
  results?: Array<{ title?: string; url?: string; content?: string }>
}

export async function searchSearx(query: string, maxResults: number): Promise<SearchHit[]> {
  for (const base of SEARX_INSTANCES) {
    try {
      const url = new URL('/search', base)
      url.searchParams.set('q', query)
      url.searchParams.set('format', 'json')
      url.searchParams.set('language', 'pt-BR')

      const res = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'ProjectCompanion/0.1' },
        signal: AbortSignal.timeout(10_000)
      })
      if (!res.ok) continue

      const data = (await res.json()) as SearxResponse
      const hits = (data.results ?? [])
        .filter((r) => r.title && r.url)
        .slice(0, maxResults)
        .map((r) => ({
          title: r.title!.trim(),
          snippet: (r.content ?? '').trim(),
          url: r.url!
        }))

      if (hits.length) return hits
    } catch {
      /* try next instance */
    }
  }
  return []
}
