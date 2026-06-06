import type { AvatarLayout } from '../../../../../shared/types'

export const LIVE2D_DEFAULT_MODEL_URL = '/models/hiyori/Hiyori.model3.json'
export const LIVE2D_DEFAULT_NAME = 'Hiyori'

const ANCHOR_X = 0.5
const ANCHOR_Y = 1

/** Unscaled model bounds captured once at load — never use model.width after scaling. */
export interface Live2DBaseSize {
  width: number
  height: number
}

type LayoutTarget = {
  scale: { set: (x: number, y?: number) => void }
  anchor: { set: (x: number, y: number) => void }
  position: { set: (x: number, y: number) => void }
}

export function measureLive2DBase(model: LayoutTarget & { getLocalBounds: () => { width: number; height: number } }): Live2DBaseSize {
  model.scale.set(1, 1)
  model.anchor.set(0, 0)
  model.position.set(0, 0)
  const bounds = model.getLocalBounds()
  return {
    width: Math.max(bounds.width, 1),
    height: Math.max(bounds.height, 1)
  }
}

export function layoutLive2DModel(
  model: LayoutTarget,
  stageW: number,
  stageH: number,
  layout: AvatarLayout,
  base: Live2DBaseSize
): void {
  const fit = Math.min(stageW / base.width, stageH / base.height) * layout.scaleFactor
  model.scale.set(fit, fit)
  model.anchor.set(ANCHOR_X, ANCHOR_Y)
  model.position.set(stageW * layout.x, stageH * layout.y)
}
