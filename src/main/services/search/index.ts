import { searchDuckDuckGo } from './providers/duckduckgo'
import { searchSearx } from './providers/searx'
import { searchWikipedia } from './providers/wikipedia'
import type { SearchHit, SearchProviderId } from './types'

export type { SearchHit } from './types'

const PROVIDERS: Array<{ id: SearchProviderId; search: (q: string, max: number) => Promise<SearchHit[]> }> =
  [
    { id: 'duckduckgo', search: searchDuckDuckGo },
    { id: 'searx', search: searchSearx },
    { id: 'wikipedia', search: searchWikipedia }
  ]

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 2, delayMs = 600): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (i < attempts - 1) await sleep(delayMs * (i + 1))
    }
  }
  throw lastErr
}

function dedupeHits(hits: SearchHit[]): SearchHit[] {
  const seen = new Set<string>()
  return hits.filter((h) => {
    const key = h.url.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Multi-provider web search with retry and fallbacks.
 * DuckDuckGo → SearXNG → Wikipedia (no API keys).
 */
export async function searchWeb(query: string, maxResults = 5): Promise<SearchHit[]> {
  const q = query.trim()
  if (!q) return []

  for (const { id, search } of PROVIDERS) {
    try {
      const hits = dedupeHits(await withRetry(() => search(q, maxResults), id === 'duckduckgo' ? 2 : 1))
      if (hits.length) {
        console.log(`[search] ${hits.length} result(s) via ${id}`)
        return hits
      }
    } catch (err) {
      console.warn(`[search] ${id} failed:`, (err as Error).message)
    }
  }

  console.warn('[search] all providers returned empty for:', q)
  return []
}
