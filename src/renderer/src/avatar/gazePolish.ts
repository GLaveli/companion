import type { GazeTarget } from '../gazeTypes'

/** Suaviza e remove micro-tremor do alvo de olhar. */
export function polishGazeTarget(raw: GazeTarget): GazeTarget {
  const eyeX = applyDeadzone(raw.eyeX, 0.035)
  const eyeY = applyDeadzone(raw.eyeY, 0.035)
  return {
    eyeX,
    eyeY,
    angleX: raw.angleX !== undefined ? applyDeadzone(raw.angleX / 30, 0.03) * 30 : undefined,
    angleY: raw.angleY !== undefined ? applyDeadzone(raw.angleY / 26, 0.03) * 26 : undefined
  }
}

function applyDeadzone(value: number, zone: number): number {
  const abs = Math.abs(value)
  if (abs <= zone) return 0
  const sign = value < 0 ? -1 : 1
  return sign * ((abs - zone) / (1 - zone))
}

let smoothed: GazeTarget | null = null

export function smoothGazeSample(raw: GazeTarget | null, blend = 0.24): GazeTarget | null {
  if (!raw) {
    if (!smoothed) return null
    smoothed = {
      eyeX: smoothed.eyeX * 0.82,
      eyeY: smoothed.eyeY * 0.82,
      angleX: (smoothed.angleX ?? 0) * 0.82,
      angleY: (smoothed.angleY ?? 0) * 0.82
    }
    if (
      Math.hypot(smoothed.eyeX, smoothed.eyeY) < 0.02 &&
      Math.hypot(smoothed.angleX ?? 0, smoothed.angleY ?? 0) < 0.5
    ) {
      smoothed = null
    }
    return smoothed
  }

  const polished = polishGazeTarget(raw)
  if (!smoothed) {
    smoothed = polished
    return smoothed
  }

  smoothed = {
    eyeX: smoothed.eyeX + (polished.eyeX - smoothed.eyeX) * blend,
    eyeY: smoothed.eyeY + (polished.eyeY - smoothed.eyeY) * blend,
    angleX: smoothed.angleX! + ((polished.angleX ?? 0) - smoothed.angleX!) * blend,
    angleY: smoothed.angleY! + ((polished.angleY ?? 0) - smoothed.angleY!) * blend
  }
  return smoothed
}

export function resetGazeSmoothing(): void {
  smoothed = null
}
