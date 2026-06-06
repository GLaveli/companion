import { searchWeb } from '../src/main/services/search/index.ts'

const queries = ['novo god of war', 'God of War Laufey', 'novo god of war laufey']

for (const q of queries) {
  console.log('\n===', q, '===')
  const hits = await searchWeb(q, 6)
  console.log('total', hits.length)
  for (const h of hits.slice(0, 4)) {
    console.log('-', h.title)
    console.log(' ', h.snippet.slice(0, 100) || '(sem snippet)')
  }
}
