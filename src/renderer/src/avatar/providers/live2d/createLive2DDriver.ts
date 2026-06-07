import type { Live2DModel } from 'pixi-live2d-display-lipsyncpatch/cubism4'
import { currentVolume } from '../../../audio/lipsync'
import type { AvatarDriver, AvatarDriverInput } from '../../types'
import { NEUTRAL_GAZE, resolveGazeTarget } from './gaze'
import { useAvatarAnimation } from '../../animationStore'

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
  let smoothEyeX = 0
  let smoothEyeY = 0
  let smoothAngleX = 0
  let smoothAngleY = 0
  let frameDelta = 1 / 60

  const lerpFactor = (speed: number): number =>
    1 - Math.exp(-speed * Math.min(frameDelta, 0.05))

  const applyLipSync = (): void => {
    const target = currentVolume()
    smoothMouth += (target - smoothMouth) * 0.4
    const open = mouthOpenFromVolume(smoothMouth)
    const lipIds = internal.motionManager.lipSyncIds
    for (const id of lipIds) {
      internal.coreModel.addParameterValueById(id, open, 0.85)
    }
  }

  const applyGaze = (): void => {
    const target = resolveGazeTarget()
    const goal = target ?? NEUTRAL_GAZE
    const releasing = !target
    const mode = useAvatarAnimation.getState().gazeMode
    const trackSpeed = mode === 'camera' ? 8 : mode === 'mouse' ? 13 : 11
    const blend = lerpFactor(releasing ? 4.5 : trackSpeed)

    smoothEyeX += (goal.eyeX - smoothEyeX) * blend
    smoothEyeY += (goal.eyeY - smoothEyeY) * blend
    smoothAngleX += ((goal.angleX ?? 0) - smoothAngleX) * blend
    smoothAngleY += ((goal.angleY ?? 0) - smoothAngleY) * blend

    const eyeMag = Math.hypot(smoothEyeX, smoothEyeY)
    const headMag = Math.hypot(smoothAngleX, smoothAngleY)
    const nearNeutral = eyeMag < 0.025 && headMag < 0.6

    if (releasing && nearNeutral) {
      smoothEyeX = 0
      smoothEyeY = 0
      smoothAngleX = 0
      smoothAngleY = 0
      return
    }

    internal.coreModel.addParameterValueById('ParamEyeBallX', smoothEyeX, 0.9)
    internal.coreModel.addParameterValueById('ParamEyeBallY', smoothEyeY, 0.92)
    internal.coreModel.addParameterValueById('ParamAngleX', smoothAngleX, 0.3)
    internal.coreModel.addParameterValueById('ParamAngleY', smoothAngleY, 0.3)
  }

  const beforeModelUpdate = (): void => {
    applyLipSync()
    applyGaze()
  }

  // Apply after idle/motion updates so the mouth is not overwritten each frame.
  internal.on('beforeModelUpdate', beforeModelUpdate)

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
      frameDelta = input.delta > 0 ? input.delta : 1 / 60
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
      internal.off('beforeModelUpdate', beforeModelUpdate)
      idleStarted = false
      smoothMouth = 0
      smoothEyeX = 0
      smoothEyeY = 0
      smoothAngleX = 0
      smoothAngleY = 0
    }
  }
}
