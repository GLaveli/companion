import { useEffect } from 'react'
import { useAvatarAnimation } from '../animationStore'
import { startFaceTracker, stopFaceTracker } from './faceTracker'

/** Liga a câmera e o rastreador facial quando o modo de olhar for "camera". */
export function useFaceTracker(): void {
  const hydrated = useAvatarAnimation((s) => s.hydrated)
  const gazeMode = useAvatarAnimation((s) => s.gazeMode)

  useEffect(() => {
    if (!hydrated) return

    if (gazeMode === 'camera') {
      void startFaceTracker().catch((err) => {
        console.warn('[face-tracker]', err)
      })
      return () => stopFaceTracker()
    }

    stopFaceTracker()
    return undefined
  }, [hydrated, gazeMode])
}
