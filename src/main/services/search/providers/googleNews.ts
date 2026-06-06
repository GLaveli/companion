import type { SearchHit } from '../types'

function decodeXml(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#160;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function searchGoogleNews(query: string, maxResults: number): Promise<SearchHit[]> {
  const url = new URL('https://news.google.com/rss/search')
  url.searchParams.set('q', query)
  url.searchParams.set('hl', 'pt-BR')
  url.searchParams.set('gl', 'BR')
  url.searchParams.set('ceid', 'BR:pt-419')

  const res = await fetch(url, {
    headers: { Accept: 'application/rss+xml' },
    signal: AbortSignal.timeout(8_000)
  })
  if (!res.ok) return []

  const xml = await res.text()
  const hits: SearchHit[] = []

  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    if (hits.length >= maxResults) break
    const item = match[1]
    const title = item.match(/<title>([^<]*)<\/title>/)?.[1]?.trim()
    const link = item.match(/<link>([^<]*)<\/link>/)?.[1]?.trim()
    const rawDesc = item.match(/<description>([\s\S]*?)<\/description>/)?.[1] ?? ''
    if (!title || !link || title === query) continue

    hits.push({
      title: decodeXml(title),
      snippet: decodeXml(rawDesc).slice(0, 280),
      url: link
    })
  }

  return hits
}
