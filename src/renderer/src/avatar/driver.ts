import { currentVolume } from '../audio/lipsync'
import { useStore } from '../store'
import type { AvatarDriverInput } from './types'

/** Builds the provider-neutral frame input from store + lip-sync. */
export function buildAvatarDriverInput(delta: number): AvatarDriverInput {
  const { phase, emotion } = useStore.getState()
  return {
    phase,
    emotion,
    mouthOpen: currentVolume(),
    delta,
    time: performance.now() / 1000
  }
}
