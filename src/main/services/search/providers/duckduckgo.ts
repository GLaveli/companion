import type { SearchHit } from '../types'

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .trim()
}

function normalizeResultUrl(raw: string): string | null {
  if (raw.includes('ad_domain') || raw.includes('/y.js?')) return null

  const uddg = raw.match(/uddg=([^&"]+)/)?.[1]
  if (uddg) return decodeURIComponent(uddg)

  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw
  return null
}

/** DuckDuckGo HTML endpoint — avoids duck-duck-scrape anomaly blocks. */
export async function searchDuckDuckGo(query: string, maxResults: number): Promise<SearchHit[]> {
  const res = await fetch('https://html.duckduckgo.com/html/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT
    },
    body: `q=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(10_000)
  })
  if (!res.ok) return []

  const html = await res.text()
  const hits: SearchHit[] = []
  const blocks = html.split('class="result results_links"')

  for (const block of blocks.slice(1)) {
    if (hits.length >= maxResults) break

    const linkMatch = block.match(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/)
    if (!linkMatch) continue

    const url = normalizeResultUrl(linkMatch[1])
    if (!url) continue

    const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/)
    hits.push({
      title: decodeHtml(linkMatch[2].replace(/<[^>]+>/g, '')),
      snippet: snippetMatch ? decodeHtml(snippetMatch[1].replace(/<[^>]+>/g, '')) : '',
      url
    })
  }

  return hits
}
