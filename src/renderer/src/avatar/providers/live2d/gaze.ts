import type { AvatarLayout } from '../../../../../shared/types'
import { useAvatarAnimation } from '../../animationStore'
import type { Live2DBaseSize } from './config'

export interface GazeContext {
  stageRect: DOMRect
  layout: AvatarLayout
  base: Live2DBaseSize
  stageW: number
  stageH: number
}

export interface GazeTarget {
  eyeX: number
  eyeY: number
  angleX?: number
  angleY?: number
}

export const NEUTRAL_GAZE: GazeTarget = {
  eyeX: 0,
  eyeY: 0,
  angleX: 0,
  angleY: 0
}

const CHAT_GAZE: GazeTarget = {
  eyeX: 0.68,
  eyeY: -0.12,
  angleX: 18,
  angleY: 6
}

let gazeContext: GazeContext | null = null
let mouseClient = { x: 0, y: 0, active: false }

export function setGazeContext(ctx: GazeContext | null): void {
  gazeContext = ctx
}

export function updateMouseClient(x: number, y: number): void {
  mouseClient = { x, y, active: true }
}

export function clearMouseClient(): void {
  mouseClient = { ...mouseClient, active: false }
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function faceCenter(ctx: GazeContext): { x: number; y: number } {
  const fit =
    Math.min(ctx.stageW / ctx.base.width, ctx.stageH / ctx.base.height) * ctx.layout.scaleFactor
  const anchorX = ctx.stageRect.left + ctx.stageW * ctx.layout.x
  const anchorY = ctx.stageRect.top + ctx.stageH * ctx.layout.y
  const faceOffsetY = ctx.base.height * fit * 0.42
  return { x: anchorX, y: anchorY - faceOffsetY }
}

function gazeFromMouse(ctx: GazeContext): GazeTarget {
  const face = faceCenter(ctx)
  const rangeX = ctx.stageW * 0.2
  const rangeY = Math.max(window.innerHeight, ctx.stageH) * 0.14
  const dx = (mouseClient.x - face.x) / rangeX
  const rawDy = (mouseClient.y - face.y) / rangeY
  // Cubism: ParamEyeBallY +1 = up; screen Y grows downward.
  const eyeX = clamp(dx, -1, 1)
  const eyeY = clamp(-rawDy, -1, 1)
  return {
    eyeX,
    eyeY,
    angleX: clamp(eyeX * 22, -28, 28),
    angleY: clamp(eyeY * 16, -24, 24)
  }
}

/** Returns a gaze target, or null to leave eyes to idle motions. */
export function resolveGazeTarget(): GazeTarget | null {
  const { gazeMode, chatTyping } = useAvatarAnimation.getState()

  if (gazeMode === 'none') return null

  if (gazeMode === 'chat') {
    return chatTyping ? CHAT_GAZE : null
  }

  if (gazeMode === 'mouse') {
    if (!mouseClient.active || !gazeContext) return null
    return gazeFromMouse(gazeContext)
  }

  return null
}
