import { search, SafeSearchType } from 'duck-duck-scrape'

export interface SearchHit {
  title: string
  snippet: string
  url: string
}

/**
 * Free web search via DuckDuckGo (no API key). Returns a compact list of hits
 * that the LLM can read to ground its answers in current information.
 */
export async function searchWeb(query: string, maxResults = 5): Promise<SearchHit[]> {
  try {
    const res = await search(query, { safeSearch: SafeSearchType.MODERATE })
    if (res.noResults || !res.results?.length) return []
    return res.results.slice(0, maxResults).map((r) => ({
      title: stripTags(r.title),
      snippet: stripTags(r.description),
      url: r.url
    }))
  } catch (err) {
    console.error('[search] failed:', err)
    return []
  }
}

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
