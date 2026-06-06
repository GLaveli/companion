import { useCallback, useRef } from 'react'
import { useStore } from '../store'
import { MicRecorder } from '../audio/recorder'
import { playWithAnalyser, speakWithWebSpeech } from '../audio/player'

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
      const tts = await window.companion.speak(text, emotion)
      if (tts.audioUrl && !tts.useWebSpeechFallback) {
        const playback = await playWithAnalyser(tts.audioUrl)
        await playback.done
      } else {
        await speakWithWebSpeech(text)
      }
    } catch (err) {
      console.error('[conversation] speak failed:', err)
      await speakWithWebSpeech(text)
    } finally {
      setSpeaking(false)
      setPhase('idle')
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
        const reply = await window.companion.chat(trimmed)
        addMessage({ role: 'assistant', content: reply.text })
        setEmotion(reply.emotion)
        await speak(reply.text, reply.emotion)
      } catch (err) {
        console.error('[conversation] chat failed:', err)
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
