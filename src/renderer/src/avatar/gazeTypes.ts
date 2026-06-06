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
