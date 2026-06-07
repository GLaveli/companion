import { shell } from 'electron'
import type { AssistantReply } from '../../../shared/types'
import {
  extractBrowserAppName,
  wantsOpenBrowserOnly,
  wantsOpenGoogleHome
} from '../intent'
import { devLog } from '../devLog'
import { getAgentTool } from '../agent/tools'

/** Instant path — abre navegador ou Google (homepage), sem pesquisa. */
export async function tryOpenBrowserCommand(text: string): Promise<AssistantReply | null> {
  if (!wantsOpenBrowserOnly(text)) {
    return null
  }

  try {
    if (wantsOpenGoogleHome(text)) {
      devLog('browser', 'abrindo Google (homepage)')
      await shell.openExternal('https://www.google.com')
      return {
        text: 'Pronto! Abri o Google no navegador.',
        emotion: 'happy'
      }
    }

    const app = extractBrowserAppName(text)
    devLog('browser', 'abrindo app', app)
    const tool = getAgentTool('openApp')
    const result = await tool.execute({ app })

    return {
      text: result.message,
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
