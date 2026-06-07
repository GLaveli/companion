import { useCallback } from 'react'
import type { AgentAction, AssistantReply } from '../../../shared/types'
import { SpeechInterruptedError, speakText } from '../audio/speakText'
import { isCurrentTurn } from '../conversation/turnSession'
import { useStore } from '../store'
import { pendingAgentActions, useAgentStore } from './agentStore'
import { logDev } from '../devLog'

export function useAgentFlow(): {
  maybeHandleAgent: (text: string, turn: number) => Promise<boolean>
} {
  const { addMessage, setPhase, setEmotion, setSpeaking } = useStore.getState()
  const requestConfirmation = useAgentStore((s) => s.requestConfirmation)

  const maybeHandleAgent = useCallback(
    async (text: string, turn: number): Promise<boolean> => {
      const pushAssistant = (content: string): void => {
        addMessage({ role: 'assistant', content })
        void window.companion.recordTurn('assistant', content)
      }

      const speak = async (
        line: string,
        emotion: AssistantReply['emotion'] = 'neutral'
      ): Promise<void> => {
        if (!isCurrentTurn(turn)) return
        setPhase('speaking')
        setSpeaking(true)
        try {
          await speakText(line, emotion, turn)
        } catch (err) {
          if (!(err instanceof SpeechInterruptedError)) {
            console.error('[agent] speak failed:', err)
          }
        } finally {
          if (isCurrentTurn(turn)) {
            setSpeaking(false)
          }
        }
      }

      const runActions = async (actions: AgentAction[]): Promise<boolean> => {
        setPhase('thinking')
        setEmotion('thinking')
        setSpeaking(false)

        try {
          const result = await window.companion.agentExecute(actions)
          if (!isCurrentTurn(turn)) return true

          const reply: AssistantReply = {
            text: result.summary,
            emotion: result.ok ? 'happy' : 'sad'
          }

          pushAssistant(reply.text)
          setEmotion(reply.emotion)
          await speak(reply.text, reply.emotion)
          return true
        } catch (err) {
          if (err instanceof SpeechInterruptedError) return true

          console.error('[agent] flow failed:', err)
          const errText = 'Ops, não consegui fazer isso no computador agora.'
          pushAssistant(errText)
          setEmotion('sad')
          await speak(errText, 'sad')
          return true
        }
      }

      const plan = await window.companion.agentPlan(text)
      logDev('agent', 'plan recebido', plan.needsAgent ? 'needsAgent' : 'skip')
      if (!isCurrentTurn(turn)) return true

      if (plan.duplicateMessage) {
        pushAssistant(plan.duplicateMessage)
        setEmotion('happy')
        await speak(plan.duplicateMessage, 'happy')
        return true
      }

      const actions = pendingAgentActions(plan)
      if (!plan.needsAgent || !actions.length) {
        return false
      }

      const needsConfirm = actions.some((a) => a.requiresConfirmation)
      const preamble =
        plan.preamble ?? 'Vou fazer isso no seu computador agora — me confirma?'

      pushAssistant(preamble)

      if (!needsConfirm) {
        logDev('agent', 'exec direto (sem modal)')
        return runActions(actions)
      }

      setPhase('idle')
      setEmotion('happy')

      const approved = await requestConfirmation(plan)
      if (!isCurrentTurn(turn)) return true

      if (!approved) {
        const cancelText = 'Tudo bem, não vou fazer nada no computador.'
        pushAssistant(cancelText)
        setEmotion('neutral')
        await speak(cancelText, 'neutral')
        return true
      }

      return runActions(actions)
    },
    [addMessage, requestConfirmation, setEmotion, setPhase, setSpeaking]
  )

  return { maybeHandleAgent }
}
