import type { AssistantReply } from '../../../shared/types'
import { buildRecallReply, isRecallQuestion } from './transcript'

export async function tryRecallShortcut(text: string): Promise<AssistantReply | null> {
  if (!isRecallQuestion(text)) return null

  return {
    text: await buildRecallReply(text),
    emotion: 'thinking'
  }
}
