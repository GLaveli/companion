import { useAvatarLayout } from '../avatar/layoutStore'
import { AVATAR_LAYOUT_LIMITS } from '../avatar/layoutLimits'

const STEP = 0.01

function pct(value: number): string {
  return `${Math.round(value * 100)}%`
}

export function AvatarLayoutControls({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}): React.JSX.Element | null {
  const { x, y, scaleFactor, setLayout, resetLayout } = useAvatarLayout()

  if (!open) return null

  const { x: xLim, y: yLim, scaleFactor: sLim } = AVATAR_LAYOUT_LIMITS

  return (
    <div className="layout-controls" onClick={(e) => e.stopPropagation()}>
      <header className="layout-controls-header">
        <strong>Posição do avatar</strong>
        <button type="button" className="layout-close" onClick={onClose} title="Fechar">
          ✕
        </button>
      </header>

      <p className="layout-note">
        Vertical acima de 100% empurra o corpo para cima (combine com zoom alto para enquadrar só o
        busto).
      </p>

      <label className="layout-row">
        <span>Vertical</span>
        <div className="layout-stepper">
          <button type="button" onClick={() => setLayout({ y: y - STEP })}>
            −
          </button>
          <input
            type="range"
            min={yLim.min}
            max={yLim.max}
            step={yLim.step}
            value={y}
            onChange={(e) => setLayout({ y: Number(e.target.value) })}
          />
          <button type="button" onClick={() => setLayout({ y: y + STEP })}>
            +
          </button>
        </div>
        <em>{pct(y)}</em>
      </label>

      <label className="layout-row">
        <span>Horizontal</span>
        <div className="layout-stepper">
          <button type="button" onClick={() => setLayout({ x: x - STEP })}>
            −
          </button>
          <input
            type="range"
            min={xLim.min}
            max={xLim.max}
            step={xLim.step}
            value={x}
            onChange={(e) => setLayout({ x: Number(e.target.value) })}
          />
          <button type="button" onClick={() => setLayout({ x: x + STEP })}>
            +
          </button>
        </div>
        <em>{pct(x)}</em>
      </label>

      <label className="layout-row">
        <span>Tamanho</span>
        <div className="layout-stepper">
          <button type="button" onClick={() => setLayout({ scaleFactor: scaleFactor - STEP })}>
            −
          </button>
          <input
            type="range"
            min={sLim.min}
            max={sLim.max}
            step={sLim.step}
            value={scaleFactor}
            onChange={(e) => setLayout({ scaleFactor: Number(e.target.value) })}
          />
          <button type="button" onClick={() => setLayout({ scaleFactor: scaleFactor + STEP })}>
            +
          </button>
        </div>
        <em>{pct(scaleFactor)}</em>
      </label>

      <div className="layout-actions">
        <button type="button" className="layout-reset" onClick={resetLayout}>
          Restaurar padrão
        </button>
        <span className="layout-hint">Salva automaticamente</span>
      </div>
    </div>
  )
}
