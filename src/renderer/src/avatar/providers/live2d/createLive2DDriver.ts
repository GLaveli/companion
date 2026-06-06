import type { Live2DModel } from 'pixi-live2d-display-lipsyncpatch/cubism4'
import type { AvatarDriver, AvatarDriverInput } from '../../types'

type MotionModel = Live2DModel & {
  motion: (group: string, index?: number | null, priority?: number) => void
  internalModel: {
    motionManager: { lipSyncIds: string[] }
    coreModel: {
      addParameterValueById: (id: string, value: number, weight?: number) => void
    }
  }
}

export function createLive2DDriver(model: Live2DModel): AvatarDriver {
  const m = model as MotionModel
  let idleStarted = false
  let gestureCooldown = 0
  let smoothMouth = 0

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

      smoothMouth += (input.mouthOpen - smoothMouth) * Math.min(1, input.delta * 16)
      const lipIds = m.internalModel.motionManager.lipSyncIds
      for (const id of lipIds) {
        m.internalModel.coreModel.addParameterValueById(id, smoothMouth * 0.95, 0.85)
      }

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
      idleStarted = false
    }
  }
}
