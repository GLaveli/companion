import { encodeWav, normalizePeak, resample, trimSilence } from './wav'

const TARGET_RATE = 16000
const SILENCE_THRESHOLD = 0.012
const SILENCE_MS = 2200
const MIN_SPEECH_MS = 400
const MAX_RECORD_MS = 45_000

export interface MicRecorderOptions {
  /** Chamado quando detecta pausa na fala — envia automaticamente. */
  onSilenceStop?: () => void
}

/**
 * Microphone recorder that captures audio and, on stop, returns a 16 kHz mono
 * WAV buffer ready to feed whisper.cpp. Optional VAD auto-stops after silence.
 */
export class MicRecorder {
  private mediaRecorder: MediaRecorder | null = null
  private chunks: Blob[] = []
  private stream: MediaStream | null = null
  private audioCtx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private vadFrame: number | null = null
  private maxTimer: ReturnType<typeof setTimeout> | null = null
  private startedAt = 0
  private heardSpeechAt: number | null = null
  private silentSince: number | null = null
  private onSilenceStop?: () => void
  private stopping = false

  async start(options: MicRecorderOptions = {}): Promise<void> {
    this.onSilenceStop = options.onSilenceStop
    this.stopping = false
    this.startedAt = Date.now()
    this.heardSpeechAt = null
    this.silentSince = null

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: false,
        autoGainControl: true
      }
    })

    this.chunks = []
    this.audioCtx = new AudioContext()
    const source = this.audioCtx.createMediaStreamSource(this.stream)
    this.analyser = this.audioCtx.createAnalyser()
    this.analyser.fftSize = 2048
    source.connect(this.analyser)

    this.mediaRecorder = new MediaRecorder(this.stream)
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data)
    }
    this.mediaRecorder.start(250)

    this.maxTimer = setTimeout(() => {
      this.onSilenceStop?.()
    }, MAX_RECORD_MS)

    this.startVad()
  }

  private startVad(): void {
    const analyser = this.analyser
    if (!analyser) return

    const buffer = new Float32Array(analyser.fftSize)
    const tick = (): void => {
      if (this.stopping || !this.analyser) return

      this.analyser.getFloatTimeDomainData(buffer)
      let sum = 0
      for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i]
      const rms = Math.sqrt(sum / buffer.length)
      const now = Date.now()

      if (rms > SILENCE_THRESHOLD) {
        if (this.heardSpeechAt === null) this.heardSpeechAt = now
        this.silentSince = null
      } else if (this.heardSpeechAt !== null) {
        if (this.silentSince === null) {
          this.silentSince = now
        } else if (
          now - this.heardSpeechAt >= MIN_SPEECH_MS &&
          now - this.silentSince >= SILENCE_MS
        ) {
          this.onSilenceStop?.()
          return
        }
      }

      this.vadFrame = requestAnimationFrame(tick)
    }

    this.vadFrame = requestAnimationFrame(tick)
  }

  async stop(): Promise<Uint8Array> {
    this.stopping = true
    if (this.vadFrame !== null) {
      cancelAnimationFrame(this.vadFrame)
      this.vadFrame = null
    }
    if (this.maxTimer) {
      clearTimeout(this.maxTimer)
      this.maxTimer = null
    }

    return new Promise((resolve, reject) => {
      const recorder = this.mediaRecorder
      if (!recorder || recorder.state === 'inactive') {
        this.cleanup()
        return reject(new Error('Recorder not started'))
      }

      recorder.onstop = async () => {
        try {
          const blob = new Blob(this.chunks, { type: this.chunks[0]?.type || 'audio/webm' })
          const wav = await this.blobToWav(blob)
          resolve(wav)
        } catch (err) {
          reject(err)
        } finally {
          this.cleanup()
        }
      }

      recorder.stop()
    })
  }

  cancel(): void {
    this.stopping = true
    if (this.vadFrame !== null) {
      cancelAnimationFrame(this.vadFrame)
      this.vadFrame = null
    }
    if (this.maxTimer) {
      clearTimeout(this.maxTimer)
      this.maxTimer = null
    }
    try {
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop()
      }
    } catch {
      /* ok */
    }
    this.cleanup()
  }

  private async blobToWav(blob: Blob): Promise<Uint8Array> {
    const arrayBuffer = await blob.arrayBuffer()
    const audioCtx = new AudioContext()
    const decoded = await audioCtx.decodeAudioData(arrayBuffer)
    const channels = decoded.numberOfChannels
    const length = decoded.length
    const mono = new Float32Array(length)
    for (let ch = 0; ch < channels; ch++) {
      const data = decoded.getChannelData(ch)
      for (let i = 0; i < length; i++) mono[i] += data[i] / channels
    }
    await audioCtx.close()
    const resampled = resample(mono, decoded.sampleRate, TARGET_RATE)
    const trimmed = trimSilence(resampled, TARGET_RATE)
    const normalized = normalizePeak(trimmed)
    return encodeWav(normalized, TARGET_RATE)
  }

  private cleanup(): void {
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
    this.mediaRecorder = null
    this.chunks = []
    void this.audioCtx?.close()
    this.audioCtx = null
    this.analyser = null
  }
}
