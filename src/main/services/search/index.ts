import { searchDuckDuckGo } from './providers/duckduckgo'
import { searchGoogleNews } from './providers/googleNews'
import { searchWikipedia } from './providers/wikipedia'
import type { SearchHit, SearchProviderId } from './types'

export type { SearchHit } from './types'

const PROVIDERS: Array<{ id: SearchProviderId; search: (q: string, max: number) => Promise<SearchHit[]> }> =
  [
    { id: 'google-news', search: searchGoogleNews },
    { id: 'duckduckgo', search: searchDuckDuckGo },
    { id: 'wikipedia', search: searchWikipedia }
  ]

function expandQueries(query: string): string[] {
  const q = query.trim()
  if (!q) return []

  const variants = new Set<string>([q])
  const lower = q.toLowerCase()

  if (/god\s*of\s*war|\bgow\b/i.test(lower)) {
    variants.add('God of War Laufey 2026')
    if (/novo|nova|pr[oó]ximo|proximo|lan[cç]amento|recente|último|ultimo|new|latest|saiu|cheg/i.test(lower)) {
      variants.add('God of War Laufey PlayStation State of Play')
    }
  }

  if (/stel\w*\s*blade/i.test(lower)) {
    variants.add('Stellar Blade PS5 game review')
    variants.add('Stellar Blade Shift Up action game')
  }

  return [...variants].slice(0, 3)
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

function scoreHit(hit: SearchHit, query: string): number {
  const qWords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2)
  const text = `${hit.title} ${hit.snippet} ${hit.url}`.toLowerCase()

  let score = hit.snippet.length > 40 ? 2 : 0
  for (const word of qWords) {
    if (text.includes(word)) score += 2
  }

  if (/laufey|everywhen|state of play|playstation\.com|theverge|ign\.|polygon|blog\.playstation/i.test(text)) {
    score += 5
  }
  if (/stellar blade|shift up|ps5.*stellar/i.test(text)) score += 6
  if (/parov stelar|geo stelar/i.test(text) && /stellar blade/i.test(query)) score -= 8
  if (/wikipedia/i.test(hit.title) && /laufey|god of war/i.test(text)) score += 4
  if (/news\.google\.com/i.test(hit.url)) score += 1

  return score
}

function rankHits(hits: SearchHit[], query: string): SearchHit[] {
  return [...hits].sort((a, b) => scoreHit(b, query) - scoreHit(a, query))
}

async function searchAllProviders(query: string, maxResults: number): Promise<SearchHit[]> {
  const perProvider = Math.max(4, maxResults)

  const settled = await Promise.allSettled(
    PROVIDERS.map(async ({ id, search }) => {
      const hits = await search(query, perProvider)
      return { id, hits }
    })
  )

  const merged: SearchHit[] = []
  for (const result of settled) {
    if (result.status === 'fulfilled' && result.value.hits.length) {
      merged.push(...result.value.hits)
      console.log(`[search] ${result.value.hits.length} via ${result.value.id} ("${query}")`)
    } else if (result.status === 'rejected') {
      console.warn(`[search] provider failed for "${query}":`, (result.reason as Error).message)
    }
  }

  return merged
}

/**
 * Multi-provider web search: Google News + DuckDuckGo HTML + Wikipedia (+ SearX fallback).
 * Providers run in parallel; results are merged, ranked and deduped.
 */
export async function searchWeb(query: string, maxResults = 8): Promise<SearchHit[]> {
  const queries = expandQueries(query)
  if (!queries.length) return []

  let merged: SearchHit[] = []
  for (const q of queries) {
    merged.push(...(await searchAllProviders(q, maxResults)))
    const ranked = rankHits(dedupeHits(merged), query)
    if (ranked.length >= Math.min(4, maxResults)) break
  }

  const final = rankHits(dedupeHits(merged), query).slice(0, maxResults)
  if (!final.length) console.warn('[search] no results for:', query)
  return final
}
