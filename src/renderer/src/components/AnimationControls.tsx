import { useEffect, useState } from 'react'
import { useAvatarAnimation } from '../avatar/animationStore'
import { getFaceTrackerStatus, resetFaceTrackerError } from '../avatar/faceTracking'
import type { AvatarGazeMode } from '../../../shared/types'

function GazeSwitch({
  label,
  mode,
  activeMode,
  onChange
}: {
  label: string
  mode: Exclude<AvatarGazeMode, 'none'>
  activeMode: AvatarGazeMode
  onChange: (mode: AvatarGazeMode) => void
}): React.JSX.Element {
  const on = activeMode === mode

  return (
    <label className="anim-switch-row">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        className={`anim-switch ${on ? 'on' : ''}`}
        onClick={() => onChange(on ? 'none' : mode)}
      >
        <span className="anim-switch-knob" aria-hidden="true" />
      </button>
    </label>
  )
}

export function AnimationControls({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}): React.JSX.Element | null {
  const gazeMode = useAvatarAnimation((s) => s.gazeMode)
  const setGazeMode = useAvatarAnimation((s) => s.setGazeMode)
  const [cameraStatus, setCameraStatus] = useState('')

  useEffect(() => {
    if (!open || gazeMode !== 'camera') {
      setCameraStatus('')
      return
    }

    const tick = (): void => {
      const status = getFaceTrackerStatus()
      setCameraStatus(status.message)
    }

    tick()
    const timer = window.setInterval(tick, 400)
    return () => window.clearInterval(timer)
  }, [open, gazeMode])

  const onGazeChange = (mode: AvatarGazeMode): void => {
    resetFaceTrackerError()
    setGazeMode(mode)
  }

  if (!open) return null

  return (
    <div className="gallery-overlay" onClick={onClose}>
      <div className="gallery-modal anim-modal" onClick={(e) => e.stopPropagation()}>
        <header className="gallery-header">
          <h2>Animação</h2>
          <button type="button" className="gallery-close" onClick={onClose} title="Fechar">
            ✕
          </button>
        </header>

        <p className="anim-note">
          Escolha no máximo uma opção de olhar. Com tudo desligado, a Lotus usa o comportamento
          padrão das animações idle.
        </p>

        <div className="anim-switch-list">
          <GazeSwitch
            label="Seguir o mouse"
            mode="mouse"
            activeMode={gazeMode}
            onChange={onGazeChange}
          />
          <GazeSwitch
            label="Olhar para o chat"
            mode="chat"
            activeMode={gazeMode}
            onChange={onGazeChange}
          />
          <GazeSwitch
            label="Olhar para você (usar câmera)"
            mode="camera"
            activeMode={gazeMode}
            onChange={onGazeChange}
          />
        </div>

        {gazeMode === 'camera' && cameraStatus ? (
          <p className="anim-camera-status">{cameraStatus}</p>
        ) : null}

        <p className="anim-hint">As preferências são salvas automaticamente.</p>
      </div>
    </div>
  )
}
