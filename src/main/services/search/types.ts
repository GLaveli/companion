export interface SearchHit {
  title: string
  snippet: string
  url: string
}

export type SearchProviderId = 'duckduckgo' | 'searx' | 'wikipedia'

export interface SearchProviderResult {
  provider: SearchProviderId
  hits: SearchHit[]
}
