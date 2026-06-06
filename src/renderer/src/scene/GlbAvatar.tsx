import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import * as THREE from 'three'
import { currentVolume } from '../audio/lipsync'

const MOUTH_KEYS = ['mouthopen', 'jawopen', 'viseme_aa', 'aa', 'mouth_open', 'vrc.v_aa']

function findBone(root: THREE.Object3D, hints: string[]): THREE.Bone | null {
  let hit: THREE.Bone | null = null
  root.traverse((obj) => {
    if (hit || !(obj as THREE.Bone).isBone) return
    const n = obj.name.toLowerCase()
    if (hints.some((h) => n.includes(h))) hit = obj as THREE.Bone
  })
  return hit
}

function findMouthMorph(mesh: THREE.SkinnedMesh): { index: number; infl: number[] } | null {
  const dict = mesh.morphTargetDictionary
  const infl = mesh.morphTargetInfluences
  if (!dict || !infl) return null
  for (const key of Object.keys(dict)) {
    if (MOUTH_KEYS.some((m) => key.toLowerCase().includes(m))) {
      return { index: dict[key], infl }
    }
  }
  return null
}

function fitToStage(root: THREE.Object3D): void {
  const box = new THREE.Box3().setFromObject(root)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const targetHeight = 1.55
  const scale = targetHeight / Math.max(size.y, 0.001)
  root.scale.setScalar(scale)
  root.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale)
  root.rotation.y = Math.PI
}

/**
 * Loads GLB models (e.g. from Sketchfab). Lip-sync uses morph targets when
 * available; otherwise only idle motion is applied.
 */
export function GlbAvatar({ url, onError }: { url: string; onError: () => void }): React.JSX.Element | null {
  const [root, setRoot] = useState<THREE.Group | null>(null)
  const mouth = useRef<{ infl: number[]; index: number } | null>(null)
  const leftArm = useRef<THREE.Bone | null>(null)
  const rightArm = useRef<THREE.Bone | null>(null)
  const smooth = useRef(0)

  useEffect(() => {
    let disposed = false
    const loader = new GLTFLoader()
    loader.load(
      url,
      (gltf) => {
        if (disposed) return
        const scene = gltf.scene
        fitToStage(scene)

        leftArm.current = findBone(scene, ['leftupperarm', 'left_arm', 'mixamorigleftarm'])
        rightArm.current = findBone(scene, ['rightupperarm', 'right_arm', 'mixamorigrightarm'])
        if (leftArm.current) leftArm.current.rotation.z += 1.1
        if (rightArm.current) rightArm.current.rotation.z -= 1.1

        scene.traverse((obj) => {
          if (mouth.current) return
          if ((obj as THREE.SkinnedMesh).isSkinnedMesh) {
            const m = findMouthMorph(obj as THREE.SkinnedMesh)
            if (m) mouth.current = { infl: m.infl, index: m.index }
          }
        })

        const group = new THREE.Group()
        group.add(scene)
        setRoot(group)
      },
      undefined,
      (err) => {
        console.warn('[glb] load failed:', err)
        onError()
      }
    )
    return () => {
      disposed = true
    }
  }, [url, onError])

  useFrame((_, delta) => {
    if (!root) return
    const t = performance.now() / 1000
    root.position.y = Math.sin(t * 1.2) * 0.012
    root.rotation.y = Math.PI + Math.sin(t * 0.35) * 0.03

    const target = currentVolume()
    smooth.current += (target - smooth.current) * Math.min(1, delta * 18)
    const m = mouth.current
    if (m) m.infl[m.index] = smooth.current * 0.85
  })

  if (!root) return null
  return <primitive object={root} />
}
