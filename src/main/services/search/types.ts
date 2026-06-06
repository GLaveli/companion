export interface SearchHit {
  title: string
  snippet: string
  url: string
}

export type SearchProviderId = 'google-news' | 'duckduckgo' | 'wikipedia' | 'searx'

export interface SearchProviderResult {
  provider: SearchProviderId
  hits: SearchHit[]
}
