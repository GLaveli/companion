/** Shared clamp ranges — values >100% / <0% allow cropping off-screen. */
export const AVATAR_LAYOUT_LIMITS = {
  x: { min: 0, max: 1.1, step: 0.005 },
  /** >100% pushes feet below the screen — scales with zoom for bust-only framing. */
  y: { min: 0.25, max: 3.5, step: 0.005 },
  scaleFactor: { min: 0.35, max: 3.2, step: 0.01 }
} as const

export function clampLayoutValue(
  key: keyof typeof AVATAR_LAYOUT_LIMITS,
  value: number
): number {
  const { min, max } = AVATAR_LAYOUT_LIMITS[key]
  return Math.min(max, Math.max(min, value))
}
