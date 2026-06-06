import type { ComponentType } from 'react'
import type { AvatarKind, Emotion } from '../../../shared/types'

/** Conversation phase mirrored from the global store. */
export type AvatarPhase = 'idle' | 'listening' | 'thinking' | 'speaking'

/**
 * Single frame of avatar state. Every provider receives the same input so the
 * conversation layer never depends on Live2D, VRM, Rive, etc.
 */
export interface AvatarDriverInput {
  phase: AvatarPhase
  emotion: Emotion
  /** Mouth openness 0..1 (from audio RMS or fallback). */
  mouthOpen: number
  delta: number
  time: number
}

/**
 * Imperative runtime created by a provider after the model loads.
 * AvatarStage calls `update` every frame; providers own their engine specifics.
 */
export interface AvatarDriver {
  update(input: AvatarDriverInput): void
  dispose(): void
}

export interface AvatarViewProps {
  /** URL to the model entrypoint (e.g. model3.json, .vrm, .riv). */
  modelUrl: string
  onError?: () => void
  onReady?: (driver: AvatarDriver) => void
}

/**
 * Pluggable avatar backend. Add a new entry to `registry.ts` to swap engines.
 */
export interface AvatarProvider {
  id: AvatarKind
  label: string
  /** Bundled default when the user has not picked a custom model. */
  defaultModelUrl: string
  defaultName: string
  View: ComponentType<AvatarViewProps>
}
