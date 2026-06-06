import { Suspense, useCallback, useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei'
import { Avatar } from './Avatar'
import { GlbAvatar } from './GlbAvatar'
import { Placeholder } from './Placeholder'
import { useStore } from '../store'

export function Scene(): React.JSX.Element {
  const avatarUrl = useStore((s) => s.avatarUrl)
  const avatarKind = useStore((s) => s.avatarKind)
  const [vrmFailed, setVrmFailed] = useState(false)
  const handleError = useCallback(() => setVrmFailed(true), [])

  // Only load a VRM when the user explicitly picked one. Otherwise show the
  // built-in catgirl maid placeholder (no auto-load of random bundled models).
  useEffect(() => setVrmFailed(false), [avatarUrl])

  return (
    <Canvas shadows camera={{ position: [0, 1.1, 2.7], fov: 30 }} dpr={[1, 2]}>
      <color attach="background" args={['#12121c']} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[2, 4, 3]} intensity={1.4} castShadow />
      <directionalLight position={[-3, 2, -2]} intensity={0.4} color="#8aa0ff" />

      <Suspense fallback={null}>
        {avatarUrl && !vrmFailed ? (
          avatarKind === 'glb' ? (
            <GlbAvatar url={avatarUrl} onError={handleError} />
          ) : (
            <Avatar url={avatarUrl} onError={handleError} />
          )
        ) : (
          <Placeholder />
        )}
        <Environment preset="city" />
      </Suspense>

      <ContactShadows position={[0, 0, 0]} opacity={0.4} scale={6} blur={2.5} far={2} />
      <OrbitControls
        target={[0, 1.1, 0]}
        enablePan={false}
        minDistance={1}
        maxDistance={4}
        maxPolarAngle={Math.PI / 1.8}
      />
    </Canvas>
  )
}
