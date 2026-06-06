/**
 * Shared bridge between the audio player and the 3D avatar. The player sets the
 * active AnalyserNode while speaking; the avatar reads the live volume each
 * frame to drive mouth movement.
 */
export const lipSyncState: { analyser: AnalyserNode | null; manual: number | null } = {
  analyser: null,
  manual: null
}

let buffer: Uint8Array<ArrayBuffer> | null = null

/** Returns the current normalised loudness (0..1) of the playing audio. */
export function currentVolume(): number {
  const analyser = lipSyncState.analyser
  if (!analyser) return lipSyncState.manual ?? 0
  if (!buffer || buffer.length !== analyser.frequencyBinCount) {
    buffer = new Uint8Array(analyser.frequencyBinCount)
  }
  analyser.getByteTimeDomainData(buffer)
  let sum = 0
  for (let i = 0; i < buffer.length; i++) {
    const v = (buffer[i] - 128) / 128
    sum += v * v
  }
  const rms = Math.sqrt(sum / buffer.length)
  // Boost a bit so normal speech opens the mouth visibly.
  return Math.min(1, rms * 2.5)
}
