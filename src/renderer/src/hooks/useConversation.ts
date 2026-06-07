import { useCallback, useRef } from 'react'
import { useAgentFlow } from '../agent/useAgent'
import { beginUserTurn, isCurrentTurn } from '../conversation/turnSession'
import { logDev } from '../devLog'
import { useStore } from '../store'
import { MicRecorder } from '../audio/recorder'
import { SpeechInterruptedError, speakResearchFillers, speakText } from '../audio/speakText'

export function useConversation(): {
  sendText: (text: string) => Promise<void>
  startListening: () => Promise<void>
  stopListening: () => Promise<void>
} {
  const recorder = useRef<MicRecorder | null>(null)
  const stoppingMic = useRef(false)
  const stopListeningRef = useRef<() => Promise<void>>(async () => undefined)
  const { setPhase, setEmotion, addMessage, setSpeaking } = useStore.getState()
  const { maybeHandleAgent } = useAgentFlow()

  const speak = useCallback(
    async (text: string, turn: number, emotion = useStore.getState().emotion) => {
      if (!isCurrentTurn(turn)) return

      setPhase('speaking')
      setSpeaking(true)
      logDev('tts', 'falando', text.slice(0, 60))
      try {
        await speakText(text, emotion, turn)
      } catch (err) {
        if (!(err instanceof SpeechInterruptedError)) {
          logDev('tts', 'erro', (err as Error).message)
        }
      } finally {
        if (isCurrentTurn(turn)) {
          setSpeaking(false)
        }
      }
    },
    [setPhase, setSpeaking]
  )

  const failTurn = useCallback(
    async (turn: number, errText: string): Promise<void> => {
      if (!isCurrentTurn(turn)) return
      addMessage({ role: 'assistant', content: errText })
      void window.companion.recordTurn('assistant', errText)
      setEmotion('sad')
      await speak(errText, turn, 'sad')
    },
    [addMessage, setEmotion, speak]
  )

  const pushAssistant = useCallback(
    (content: string): void => {
      addMessage({ role: 'assistant', content })
      void window.companion.recordTurn('assistant', content)
    },
    [addMessage]
  )

  const sendText = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return

      const turn = beginUserTurn()
      logDev('chat', 'usuário', trimmed.slice(0, 80))

      addMessage({ role: 'user', content: trimmed })
      void window.companion.recordTurn('user', trimmed)
      setPhase('thinking')
      setEmotion('thinking')
      setSpeaking(false)

      try {
        if (!isCurrentTurn(turn)) return

        logDev('chat', 'shortcut…')
        const shortcut = await window.companion.conversationShortcut(trimmed)
        if (shortcut) {
          logDev('chat', 'atalho', shortcut.text.slice(0, 60))
          pushAssistant(shortcut.text)
          setEmotion(shortcut.emotion)
          await speak(shortcut.text, turn, shortcut.emotion)
          return
        }

        logDev('chat', 'agente…')
        if (await maybeHandleAgent(trimmed, turn)) {
          logDev('chat', 'agente tratou')
          return
        }

        if (!isCurrentTurn(turn)) return

        logDev('chat', 'llm plan…')
        const plan = await window.companion.chatPlan(trimmed)
        if (!isCurrentTurn(turn)) return

        if (plan.needsResearch && plan.preamble) {
          logDev('chat', 'pesquisa interna')
          pushAssistant(plan.preamble)

          setPhase('speaking')
          setSpeaking(true)
          try {
            const researchPromise = window.companion.chatResearch(trimmed, plan.preamble)

            await speakText(plan.preamble, 'thinking', turn)
            await speakResearchFillers(researchPromise, trimmed, turn, 'thinking')

            if (!isCurrentTurn(turn)) return

            const followUp = await researchPromise
            if (!isCurrentTurn(turn)) return

            logDev('chat', 'pesquisa ok', followUp.text.slice(0, 60))
            pushAssistant(followUp.text)
            setEmotion(followUp.emotion)
            await speakText(followUp.text, followUp.emotion, turn)
          } catch (err) {
            if (!(err instanceof SpeechInterruptedError)) {
              logDev('chat', 'pesquisa erro', (err as Error).message)
              await failTurn(turn, 'Ops, a pesquisa falhou — tenta de novo?')
            }
          } finally {
            if (isCurrentTurn(turn)) {
              setSpeaking(false)
            }
          }
        } else {
          if (!isCurrentTurn(turn)) return

          logDev('chat', 'llm chat…')
          const reply = await window.companion.chat(trimmed)
          if (!isCurrentTurn(turn)) return

          logDev('chat', 'llm ok', reply.text.slice(0, 60))
          pushAssistant(reply.text)
          setEmotion(reply.emotion)
          await speak(reply.text, turn, reply.emotion)
        }
      } catch (err) {
        if (!(err instanceof SpeechInterruptedError)) {
          const msg = (err as Error).message
          logDev('chat', 'erro fatal', msg)
          await failTurn(turn, 'Ops, deu um probleminha — vê o Log abaixo e tenta de novo.')
        }
      } finally {
        if (isCurrentTurn(turn)) {
          setPhase('idle')
          logDev('chat', 'turno fim')
        }
      }
    },
    [failTurn, maybeHandleAgent, pushAssistant, setPhase, setEmotion, speak]
  )

  const stopListening = useCallback(async () => {
    const rec = recorder.current
    if (!rec || stoppingMic.current) return

    stoppingMic.current = true
    setPhase('thinking')
    logDev('mic', 'transcrevendo…')

    try {
      const wav = await rec.stop()
      const { text } = await window.companion.transcribe(wav)
      const trimmed = text.trim()

      logDev('mic', 'texto', trimmed.slice(0, 80) || '(vazio)')

      if (trimmed) {
        await sendText(trimmed)
      } else {
        addMessage({
          role: 'assistant',
          content: 'Não entendi — pode repetir ou digitar?'
        })
        setPhase('idle')
      }
    } catch (err) {
      logDev('mic', 'transcrição erro', (err as Error).message)
      addMessage({
        role: 'assistant',
        content: 'Problema no microfone — verifica a permissão do macOS e tenta de novo.'
      })
      setPhase('idle')
    } finally {
      recorder.current = null
      stoppingMic.current = false
    }
  }, [addMessage, sendText, setPhase])

  stopListeningRef.current = stopListening

  const startListening = useCallback(async () => {
    if (recorder.current || stoppingMic.current) return

    const turn = beginUserTurn()
    useStore.getState().setSpeaking(false)

    try {
      const mic = new MicRecorder()
      recorder.current = mic
      await mic.start({
        onSilenceStop: () => {
          void stopListeningRef.current()
        }
      })

      if (!isCurrentTurn(turn)) {
        mic.cancel()
        recorder.current = null
        return
      }

      setPhase('listening')
      logDev('mic', 'ouvindo')
    } catch (err) {
      recorder.current = null
      logDev('mic', 'erro', (err as Error).message)
      addMessage({
        role: 'assistant',
        content:
          'Não consegui abrir o microfone — autoriza em Ajustes do Sistema → Privacidade → Microfone.'
      })
      if (isCurrentTurn(turn)) {
        setPhase('idle')
      }
    }
  }, [addMessage, setPhase])

  return { sendText, startListening, stopListening }
}
