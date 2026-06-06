import { search, SafeSearchType } from 'duck-duck-scrape'
import type { SearchHit } from '../types'

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .trim()
}

export async function searchDuckDuckGo(query: string, maxResults: number): Promise<SearchHit[]> {
  const res = await search(query, { safeSearch: SafeSearchType.MODERATE })
  if (res.noResults || !res.results?.length) return []
  return res.results.slice(0, maxResults).map((r) => ({
    title: stripTags(r.title),
    snippet: stripTags(r.description),
    url: r.url
  }))
}
