import { shell } from 'electron'
import type { AssistantReply } from '../../../shared/types'
import { extractBrowserSearchQuery, isMeaningfulSearchQuery, wantsBrowserSearch } from '../intent'
import { devLog } from '../devLog'
import { persistEvent, EVENT_ID_OFFSET, getCurrentSessionId } from '../memory'
import { enqueueMemoryWrite } from '../memory/writeQueue'
import { indexMemoryPoint } from '../memory/qdrant'

function googleSearchUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query.trim())}`
}

/** Instant path — opens Google without LLM or agent IPC round-trips. */
export async function tryBrowserSearchCommand(text: string): Promise<AssistantReply | null> {
  if (!wantsBrowserSearch(text)) {
    return null
  }

  const query = extractBrowserSearchQuery(text)
  if (!isMeaningfulSearchQuery(query, text)) {
    devLog('browser', 'sem termo de busca — ignorando atalho Google', text.slice(0, 60))
    return null
  }

  const url = googleSearchUrl(query)
  devLog('browser', 'abrindo Google', query)

  try {
    await shell.openExternal(url)
    devLog('browser', 'Google aberto', url)
    enqueueMemoryWrite(async () => {
      const event = persistEvent('browser_search', { query })
      await indexMemoryPoint({
        id: EVENT_ID_OFFSET + event.id,
        role: 'user',
        content: `Pesquisa no Google: ${query}`,
        at: event.at,
        sessionId: getCurrentSessionId(),
        kind: 'event'
      })
    })
    return {
      text: `Pronto! Abri o Google com «${query}» no seu navegador.`,
      emotion: 'happy'
    }
  } catch (err) {
    const msg = (err as Error).message
    devLog('browser', 'falha ao abrir navegador', msg)
    return {
      text: `Não consegui abrir o navegador: ${msg}`,
      emotion: 'sad'
    }
  }
}
