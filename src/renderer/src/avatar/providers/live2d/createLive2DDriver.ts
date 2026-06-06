import type { Live2DModel } from 'pixi-live2d-display-lipsyncpatch/cubism4'
import { currentVolume } from '../../../audio/lipsync'
import type { AvatarDriver, AvatarDriverInput } from '../../types'

type MotionModel = Live2DModel & {
  motion: (group: string, index?: number | null, priority?: number) => void
  internalModel: {
    on: (event: 'beforeModelUpdate', fn: () => void) => void
    off: (event: 'beforeModelUpdate', fn: () => void) => void
    motionManager: { lipSyncIds: string[] }
    coreModel: {
      addParameterValueById: (id: string, value: number, weight?: number) => void
    }
  }
}

function mouthOpenFromVolume(raw: number): number {
  if (raw <= 0.02) return 0
  return Math.min(1, Math.max(0.35, raw * 1.25))
}

export function createLive2DDriver(model: Live2DModel): AvatarDriver {
  const m = model as MotionModel
  const internal = m.internalModel
  let idleStarted = false
  let gestureCooldown = 0
  let smoothMouth = 0

  const applyLipSync = (): void => {
    const target = currentVolume()
    smoothMouth += (target - smoothMouth) * 0.4
    const open = mouthOpenFromVolume(smoothMouth)
    const lipIds = internal.motionManager.lipSyncIds
    for (const id of lipIds) {
      internal.coreModel.addParameterValueById(id, open, 0.85)
    }
  }

  // Apply after idle/motion updates so the mouth is not overwritten each frame.
  internal.on('beforeModelUpdate', applyLipSync)

  const startIdle = (): void => {
    if (idleStarted) return
    idleStarted = true
    try {
      m.motion('Idle', null, 1)
    } catch {
      /* model may use a different motion group name */
    }
  }

  return {
    update(input: AvatarDriverInput) {
      startIdle()

      gestureCooldown -= input.delta
      if (input.emotion === 'happy' && input.phase === 'speaking' && gestureCooldown <= 0) {
        gestureCooldown = 12
        try {
          m.motion('TapBody', null, 2)
        } catch {
          /* optional gesture group */
        }
      }
    },

    dispose() {
      internal.off('beforeModelUpdate', applyLipSync)
      idleStarted = false
      smoothMouth = 0
    }
  }
}
