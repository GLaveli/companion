export type FaceTrackerState = 'idle' | 'starting' | 'active' | 'error'

export interface FaceTrackerStatus {
  state: FaceTrackerState
  message: string
}
