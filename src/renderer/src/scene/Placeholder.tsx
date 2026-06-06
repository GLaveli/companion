import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { currentVolume } from '../audio/lipsync'
import { useStore } from '../store'

const EMOTION_COLOR: Record<string, string> = {
  neutral: '#2a2038',
  happy: '#4a3060',
  sad: '#1e3048',
  angry: '#4a2028',
  surprised: '#3a2858',
  thinking: '#283848'
}

const SKIN = '#f5d5c8'
const HAIR = '#2b1f3d'
const EYE = '#3d2a5c'
const APRON = '#f8f4ef'
const BOW = '#ff7eb6'

/**
 * Stylised catgirl maid placeholder until the user loads a real VRM from VRoid Hub.
 * Has idle motion, blinking and lip-sync.
 */
export function Placeholder(): React.JSX.Element {
  const root = useRef<THREE.Group>(null)
  const mouth = useRef<THREE.Mesh>(null)
  const leftLid = useRef<THREE.Mesh>(null)
  const rightLid = useRef<THREE.Mesh>(null)
  const bow = useRef<THREE.MeshStandardMaterial>(null)
  const dress = useRef<THREE.MeshStandardMaterial>(null)
  const mouthSmooth = useRef(0)
  const blinkPhase = useRef(0)
  const nextBlink = useRef(2.5)

  useFrame((_, delta) => {
    const t = performance.now() / 1000

    if (root.current) {
      root.current.position.y = Math.sin(t * 1.2) * 0.015
      root.current.rotation.y = Math.sin(t * 0.35) * 0.04
    }

    const target = currentVolume()
    mouthSmooth.current += (target - mouthSmooth.current) * Math.min(1, delta * 18)
    if (mouth.current) mouth.current.scale.y = 0.25 + mouthSmooth.current * 1.4

    blinkPhase.current += delta
    let blink = 0
    if (blinkPhase.current > nextBlink.current) {
      const elapsed = blinkPhase.current - nextBlink.current
      blink = elapsed < 0.08 ? elapsed / 0.08 : elapsed < 0.16 ? 1 - (elapsed - 0.08) / 0.08 : 0
      if (elapsed > 0.16) {
        blinkPhase.current = 0
        nextBlink.current = 2 + Math.random() * 3
      }
    }
    const lidY = 1.42 - blink * 0.055
    if (leftLid.current) leftLid.current.position.y = lidY
    if (rightLid.current) rightLid.current.position.y = lidY

    const emotion = useStore.getState().emotion
    if (dress.current) {
      dress.current.color.lerp(
        new THREE.Color(EMOTION_COLOR[emotion] ?? EMOTION_COLOR.neutral),
        Math.min(1, delta * 3)
      )
    }
    if (bow.current && emotion === 'happy') {
      bow.current.emissive.lerp(new THREE.Color('#ff9fd0'), Math.min(1, delta * 4))
    } else if (bow.current) {
      bow.current.emissive.lerp(new THREE.Color('#000000'), Math.min(1, delta * 4))
    }
  })

  return (
    <group ref={root} position={[0, -0.05, 0]}>
      {/* Hair back */}
      <mesh position={[0, 1.48, -0.08]} castShadow>
        <sphereGeometry args={[0.36, 32, 32]} />
        <meshStandardMaterial color={HAIR} roughness={0.85} />
      </mesh>

      {/* Face */}
      <mesh position={[0, 1.38, 0]} castShadow>
        <sphereGeometry args={[0.28, 48, 48]} />
        <meshStandardMaterial color={SKIN} roughness={0.55} />
      </mesh>

      {/* Bangs */}
      <mesh position={[0, 1.52, 0.12]} rotation={[0.2, 0, 0]}>
        <boxGeometry args={[0.5, 0.14, 0.12]} />
        <meshStandardMaterial color={HAIR} roughness={0.85} />
      </mesh>

      {/* Cat ears */}
      <mesh position={[-0.2, 1.62, 0.02]} rotation={[0.3, 0, -0.35]} castShadow>
        <coneGeometry args={[0.09, 0.2, 4]} />
        <meshStandardMaterial color={HAIR} roughness={0.8} />
      </mesh>
      <mesh position={[0.2, 1.62, 0.02]} rotation={[0.3, 0, 0.35]} castShadow>
        <coneGeometry args={[0.09, 0.2, 4]} />
        <meshStandardMaterial color={HAIR} roughness={0.8} />
      </mesh>
      <mesh position={[-0.2, 1.6, 0.06]} rotation={[0.3, 0, -0.35]}>
        <coneGeometry args={[0.05, 0.12, 4]} />
        <meshStandardMaterial color="#ffb8d0" roughness={0.7} />
      </mesh>
      <mesh position={[0.2, 1.6, 0.06]} rotation={[0.3, 0, 0.35]}>
        <coneGeometry args={[0.05, 0.12, 4]} />
        <meshStandardMaterial color="#ffb8d0" roughness={0.7} />
      </mesh>

      {/* Eyes */}
      <mesh position={[-0.1, 1.4, 0.24]}>
        <sphereGeometry args={[0.045, 16, 16]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0.1, 1.4, 0.24]}>
        <sphereGeometry args={[0.045, 16, 16]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh position={[-0.1, 1.4, 0.27]}>
        <sphereGeometry args={[0.028, 16, 16]} />
        <meshStandardMaterial color={EYE} />
      </mesh>
      <mesh position={[0.1, 1.4, 0.27]}>
        <sphereGeometry args={[0.028, 16, 16]} />
        <meshStandardMaterial color={EYE} />
      </mesh>

      {/* Eyelids (blink) */}
      <mesh ref={leftLid} position={[-0.1, 1.42, 0.255]}>
        <boxGeometry args={[0.1, 0.03, 0.04]} />
        <meshStandardMaterial color={HAIR} />
      </mesh>
      <mesh ref={rightLid} position={[0.1, 1.42, 0.255]}>
        <boxGeometry args={[0.1, 0.03, 0.04]} />
        <meshStandardMaterial color={HAIR} />
      </mesh>

      {/* Mouth */}
      <mesh ref={mouth} position={[0, 1.28, 0.26]}>
        <boxGeometry args={[0.1, 0.04, 0.03]} />
        <meshStandardMaterial color="#c45b72" />
      </mesh>

      {/* Maid headband */}
      <mesh position={[0, 1.54, 0.1]}>
        <torusGeometry args={[0.27, 0.018, 8, 32]} />
        <meshStandardMaterial color="#ffffff" roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.54, 0.28]}>
        <boxGeometry args={[0.12, 0.08, 0.02]} />
        <meshStandardMaterial ref={bow} color={BOW} roughness={0.35} />
      </mesh>

      {/* Torso / dress */}
      <mesh position={[0, 0.95, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.3, 0.55, 24]} />
        <meshStandardMaterial ref={dress} color={EMOTION_COLOR.neutral} roughness={0.55} />
      </mesh>

      {/* Apron */}
      <mesh position={[0, 0.92, 0.18]}>
        <boxGeometry args={[0.28, 0.45, 0.04]} />
        <meshStandardMaterial color={APRON} roughness={0.45} />
      </mesh>

      {/* Arms (relaxed, not T-pose) */}
      <mesh position={[-0.34, 1.02, 0.05]} rotation={[0.2, 0, 0.6]} castShadow>
        <capsuleGeometry args={[0.05, 0.28, 6, 12]} />
        <meshStandardMaterial color={SKIN} roughness={0.55} />
      </mesh>
      <mesh position={[0.34, 1.02, 0.05]} rotation={[0.2, 0, -0.6]} castShadow>
        <capsuleGeometry args={[0.05, 0.28, 6, 12]} />
        <meshStandardMaterial color={SKIN} roughness={0.55} />
      </mesh>

      {/* Skirt */}
      <mesh position={[0, 0.62, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.38, 0.22, 24]} />
        <meshStandardMaterial color="#1a1428" roughness={0.6} />
      </mesh>

      {/* Legs */}
      <mesh position={[-0.12, 0.28, 0.02]} castShadow>
        <capsuleGeometry args={[0.07, 0.35, 6, 12]} />
        <meshStandardMaterial color="#1a1428" roughness={0.6} />
      </mesh>
      <mesh position={[0.12, 0.28, 0.02]} castShadow>
        <capsuleGeometry args={[0.07, 0.35, 6, 12]} />
        <meshStandardMaterial color="#1a1428" roughness={0.6} />
      </mesh>
    </group>
  )
}
