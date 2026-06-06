import { encodeWav, resample } from './wav'

const TARGET_RATE = 16000

/**
 * Microphone recorder that captures audio and, on stop, returns a 16 kHz mono
 * WAV buffer ready to feed whisper.cpp.
 */
export class MicRecorder {
  private mediaRecorder: MediaRecorder | null = null
  private chunks: Blob[] = []
  private stream: MediaStream | null = null

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    this.chunks = []
    this.mediaRecorder = new MediaRecorder(this.stream)
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data)
    }
    this.mediaRecorder.start()
  }

  async stop(): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      const recorder = this.mediaRecorder
      if (!recorder) return reject(new Error('Recorder not started'))
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

  private async blobToWav(blob: Blob): Promise<Uint8Array> {
    const arrayBuffer = await blob.arrayBuffer()
    const audioCtx = new AudioContext()
    const decoded = await audioCtx.decodeAudioData(arrayBuffer)
    // Downmix to mono.
    const channels = decoded.numberOfChannels
    const length = decoded.length
    const mono = new Float32Array(length)
    for (let ch = 0; ch < channels; ch++) {
      const data = decoded.getChannelData(ch)
      for (let i = 0; i < length; i++) mono[i] += data[i] / channels
    }
    await audioCtx.close()
    const resampled = resample(mono, decoded.sampleRate, TARGET_RATE)
    return encodeWav(resampled, TARGET_RATE)
  }

  private cleanup(): void {
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
    this.mediaRecorder = null
    this.chunks = []
  }
}
