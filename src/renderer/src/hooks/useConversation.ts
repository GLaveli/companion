import { useCallback, useRef } from 'react'
import { useStore } from '../store'
import { MicRecorder } from '../audio/recorder'
import { speakText } from '../audio/speakText'

export function useConversation(): {
  sendText: (text: string) => Promise<void>
  startListening: () => Promise<void>
  stopListening: () => Promise<void>
} {
  const recorder = useRef<MicRecorder | null>(null)
  const { setPhase, setEmotion, addMessage, setSpeaking } = useStore.getState()

  const speak = useCallback(async (text: string, emotion = useStore.getState().emotion) => {
    setPhase('speaking')
    setSpeaking(true)
    try {
      await speakText(text, emotion)
    } catch (err) {
      console.error('[conversation] speak failed:', err)
    } finally {
      setSpeaking(false)
    }
  }, [setPhase, setSpeaking])

  const sendText = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return
      addMessage({ role: 'user', content: trimmed })
      setPhase('thinking')
      setEmotion('thinking')

      try {
        const plan = await window.companion.chatPlan(trimmed)

        if (plan.needsResearch && plan.preamble) {
          addMessage({ role: 'assistant', content: plan.preamble })

          const researchPromise = window.companion.chatResearch(trimmed, plan.preamble)
          await speak(plan.preamble, 'thinking')

          setPhase('thinking')
          setEmotion('thinking')
          const followUp = await researchPromise

          addMessage({ role: 'assistant', content: followUp.text })
          setEmotion(followUp.emotion)
          await speak(followUp.text, followUp.emotion)
        } else {
          const reply = await window.companion.chat(trimmed)
          addMessage({ role: 'assistant', content: reply.text })
          setEmotion(reply.emotion)
          await speak(reply.text, reply.emotion)
        }
      } catch (err) {
        console.error('[conversation] chat failed:', err)
      } finally {
        setPhase('idle')
      }
    },
    [addMessage, setPhase, setEmotion, speak]
  )

  const startListening = useCallback(async () => {
    try {
      recorder.current = new MicRecorder()
      await recorder.current.start()
      setPhase('listening')
    } catch (err) {
      console.error('[conversation] mic start failed:', err)
      setPhase('idle')
    }
  }, [setPhase])

  const stopListening = useCallback(async () => {
    const rec = recorder.current
    if (!rec) return
    setPhase('thinking')
    try {
      const wav = await rec.stop()
      const { text } = await window.companion.transcribe(wav)
      if (text.trim()) {
        await sendText(text)
      } else {
        setPhase('idle')
      }
    } catch (err) {
      console.error('[conversation] transcription failed:', err)
      setPhase('idle')
    } finally {
      recorder.current = null
    }
  }, [sendText, setPhase])

  return { sendText, startListening, stopListening }
}
