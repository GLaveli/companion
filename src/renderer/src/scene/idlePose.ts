import type { VRM } from '@pixiv/three-vrm'
import * as THREE from 'three'

/** Bones we gently animate every frame for a living idle pose. */
const IDLE_BONES = [
  'spine',
  'chest',
  'neck',
  'head',
  'leftUpperArm',
  'rightUpperArm',
  'leftLowerArm',
  'rightLowerArm'
] as const

type IdleBone = (typeof IDLE_BONES)[number]

const REST: Partial<Record<IdleBone, THREE.Euler>> = {
  spine: new THREE.Euler(0.04, 0, 0),
  chest: new THREE.Euler(0.03, 0, 0),
  neck: new THREE.Euler(0.06, 0, 0),
  head: new THREE.Euler(0.08, 0, 0),
  leftUpperArm: new THREE.Euler(0.15, 0, 1.25),
  rightUpperArm: new THREE.Euler(0.15, 0, -1.25),
  leftLowerArm: new THREE.Euler(0, 0, 0.35),
  rightLowerArm: new THREE.Euler(0, 0, -0.35)
}

/**
 * Pulls a VRM out of bind T-pose into a relaxed standing pose. Many free models
 * ship without idle VRMA clips, so we do this procedurally.
 */
export function applyRestPose(vrm: VRM): void {
  if (!vrm.humanoid) return
  for (const bone of IDLE_BONES) {
    const node = vrm.humanoid.getNormalizedBoneNode(bone)
    const rot = REST[bone]
    if (node && rot) node.rotation.copy(rot)
  }
}

/** Subtle breathing / sway layered on top of the rest pose each frame. */
export function updateIdleMotion(vrm: VRM, t: number): void {
  if (!vrm.humanoid) return
  const breath = Math.sin(t * 1.4) * 0.02
  const sway = Math.sin(t * 0.7) * 0.015

  const spine = vrm.humanoid.getNormalizedBoneNode('spine')
  const chest = vrm.humanoid.getNormalizedBoneNode('chest')
  const head = vrm.humanoid.getNormalizedBoneNode('head')
  const neck = vrm.humanoid.getNormalizedBoneNode('neck')

  if (spine && REST.spine) {
    spine.rotation.x = REST.spine.x + breath
    spine.rotation.z = sway
  }
  if (chest && REST.chest) chest.rotation.x = REST.chest.x + breath * 0.5
  if (neck && REST.neck) neck.rotation.y = Math.sin(t * 0.5) * 0.04
  if (head && REST.head) {
    head.rotation.x = REST.head.x + Math.sin(t * 0.9) * 0.03
    head.rotation.y = Math.sin(t * 0.45) * 0.06
  }
}
