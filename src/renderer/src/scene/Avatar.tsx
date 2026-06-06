import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import {
  VRM,
  VRMLoaderPlugin,
  VRMUtils,
  VRMExpressionPresetName,
  type VRMExpressionManager
} from '@pixiv/three-vrm'
import { currentVolume } from '../audio/lipsync'
import { useStore } from '../store'
import { applyRestPose, updateIdleMotion } from './idlePose'
import type { Emotion } from '../../../shared/types'

const EMOTION_TO_EXPRESSION: Record<Emotion, VRMExpressionPresetName | null> = {
  neutral: null,
  happy: VRMExpressionPresetName.Happy,
  sad: VRMExpressionPresetName.Sad,
  angry: VRMExpressionPresetName.Angry,
  surprised: VRMExpressionPresetName.Surprised,
  thinking: VRMExpressionPresetName.Relaxed
}

function hasPreset(em: VRMExpressionManager, preset: VRMExpressionPresetName): boolean {
  return preset in em.presetExpressionMap
}

export function Avatar({ url, onError }: { url: string; onError: () => void }): React.JSX.Element | null {
  const [vrm, setVrm] = useState<VRM | null>(null)
  const blinkTimer = useRef(0)
  const nextBlink = useRef(2 + Math.random() * 3)
  const mouth = useRef(0)
  const currentEmotion = useRef<Emotion>('neutral')

  useEffect(() => {
    let disposed = false
    const loader = new GLTFLoader()
    loader.register((parser) => new VRMLoaderPlugin(parser))
    loader.load(
      url,
      (gltf) => {
        if (disposed) return
        const loaded = gltf.userData.vrm as VRM
        if (!loaded?.humanoid) {
          console.warn('[avatar] not a humanoid VRM, using placeholder')
          onError()
          return
        }
        VRMUtils.removeUnnecessaryVertices(gltf.scene)
        VRMUtils.combineSkeletons(gltf.scene)
        VRMUtils.rotateVRM0(loaded)
        applyRestPose(loaded)
        // Centre roughly at origin; many VRoid models are offset.
        loaded.scene.position.set(0, 0, 0)
        setVrm(loaded)
      },
      undefined,
      (err) => {
        console.warn('[avatar] could not load VRM, using placeholder:', err)
        onError()
      }
    )
    return () => {
      disposed = true
    }
  }, [url, onError])

  useFrame((_, delta) => {
    if (!vrm) return
    const em = vrm.expressionManager
    const t = performance.now() / 1000

    updateIdleMotion(vrm, t)

    if (em) {
      const target = currentVolume()
      mouth.current += (target - mouth.current) * Math.min(1, delta * 18)

      // Only drive mouth shapes the model actually has (VRoid models do; weird CC0 models may not).
      if (hasPreset(em, VRMExpressionPresetName.Aa)) {
        em.setValue(VRMExpressionPresetName.Aa, mouth.current)
      }
      if (hasPreset(em, VRMExpressionPresetName.Oh)) {
        em.setValue(VRMExpressionPresetName.Oh, mouth.current * 0.35)
      }

      if (hasPreset(em, VRMExpressionPresetName.Blink)) {
        blinkTimer.current += delta
        let blink = 0
        if (blinkTimer.current > nextBlink.current) {
          const elapsed = blinkTimer.current - nextBlink.current
          blink = elapsed < 0.1 ? elapsed / 0.1 : elapsed < 0.2 ? 1 - (elapsed - 0.1) / 0.1 : 0
          if (elapsed > 0.2) {
            blinkTimer.current = 0
            nextBlink.current = 2 + Math.random() * 3
          }
        }
        em.setValue(VRMExpressionPresetName.Blink, blink)
      }

      const desired = useStore.getState().emotion
      if (desired !== currentEmotion.current) {
        for (const e of Object.values(EMOTION_TO_EXPRESSION)) {
          if (e && hasPreset(em, e)) em.setValue(e, 0)
        }
        currentEmotion.current = desired
      }
      const expr = EMOTION_TO_EXPRESSION[desired]
      if (expr && hasPreset(em, expr)) em.setValue(expr, 0.65)
    }

    vrm.update(delta)
  })

  if (!vrm) return null
  return <primitive object={vrm.scene} />
}
