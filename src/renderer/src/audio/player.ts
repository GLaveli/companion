import { lipSyncState } from './lipsync'

/**
 * Plays an audio data URL and exposes a live AnalyserNode so the avatar can
 * lip-sync to the actual sound. Resolves when playback finishes.
 */
let sharedCtx: AudioContext | null = null

function ctx(): AudioContext {
  if (!sharedCtx) sharedCtx = new AudioContext()
  return sharedCtx
}

export interface Playback {
  analyser: AnalyserNode
  done: Promise<void>
  stop: () => void
}

export async function playWithAnalyser(audioUrl: string): Promise<Playback> {
  const audioCtx = ctx()
  await audioCtx.resume()

  const audio = new Audio(audioUrl)
  audio.crossOrigin = 'anonymous'

  const source = audioCtx.createMediaElementSource(audio)
  const analyser = audioCtx.createAnalyser()
  analyser.fftSize = 512
  analyser.smoothingTimeConstant = 0.35
  source.connect(analyser)
  analyser.connect(audioCtx.destination)

  lipSyncState.analyser = analyser

  const cleanup = (): void => {
    if (lipSyncState.analyser === analyser) lipSyncState.analyser = null
  }

  const done = new Promise<void>((resolve) => {
    audio.onended = () => {
      cleanup()
      resolve()
    }
    audio.onerror = () => {
      cleanup()
      resolve()
    }
  })

  await audio.play()

  return {
    analyser,
    done,
    stop: () => {
      audio.pause()
      audio.currentTime = 0
      cleanup()
    }
  }
}

/** Offline fallback voice using the browser's built-in speech synthesis. */
export function speakWithWebSpeech(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) return resolve()
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'pt-BR'
    const voices = window.speechSynthesis.getVoices()
    const ptFemale =
      voices.find((v) => v.lang.startsWith('pt') && /female|maria|luciana|fernanda/i.test(v.name)) ||
      voices.find((v) => v.lang.startsWith('pt'))
    if (ptFemale) utter.voice = ptFemale

    // Drive a synthetic mouth movement since this audio bypasses the analyser.
    const timer = window.setInterval(() => {
      lipSyncState.manual = 0.2 + Math.random() * 0.6
    }, 90)
    const stop = (): void => {
      window.clearInterval(timer)
      lipSyncState.manual = null
      resolve()
    }
    utter.onend = stop
    utter.onerror = stop
    window.speechSynthesis.speak(utter)
  })
}
