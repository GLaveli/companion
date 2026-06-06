import { useCallback, useEffect, useRef, useState } from 'react'

const CLOSE_MS = 380

type StageToolbarProps = {
  voiceOpen: boolean
  layoutOpen: boolean
  onGallery: () => void
  onVoice: () => void
  onAnimation: () => void
  onLayout: () => void
}

export function StageToolbar({
  voiceOpen,
  layoutOpen,
  onGallery,
  onVoice,
  onAnimation,
  onLayout
}: StageToolbarProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const closeTimer = useRef<number | null>(null)

  const closeMenu = useCallback((): void => {
    if (!open || closing) return
    setClosing(true)
    closeTimer.current = window.setTimeout(() => {
      setOpen(false)
      setClosing(false)
    }, CLOSE_MS)
  }, [open, closing])

  const openMenu = (): void => {
    if (closing) return
    setOpen(true)
  }

  useEffect(() => {
    return () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
    }
  }, [])

  const showMenu = open || closing
  const gearVisible = !open && !closing

  return (
    <div className={`stage-toolbar ${open ? 'open' : ''} ${closing ? 'closing' : ''}`}>
      <button
        type="button"
        className={`stage-tool-btn stage-tool-gear ${gearVisible ? 'visible' : 'leaving'}`}
        onClick={openMenu}
        title="Ferramentas do avatar"
        aria-label="Abrir ferramentas"
        aria-expanded={open}
        aria-hidden={!gearVisible}
        tabIndex={gearVisible ? 0 : -1}
      >
        ⚙
      </button>

      {showMenu ? (
        <div
          className={`stage-tool-menu ${open && !closing ? 'visible' : ''} ${closing ? 'leaving' : ''}`}
        >
          <button
            type="button"
            className="stage-tool-close"
            style={{ '--i': 0 } as React.CSSProperties}
            onClick={closeMenu}
            title="Fechar"
            aria-label="Fechar ferramentas"
          >
            ✕
          </button>

          <button
            type="button"
            className="stage-tool-btn primary"
            style={{ '--i': 1 } as React.CSSProperties}
            onClick={onGallery}
          >
            Galeria
          </button>
          <button
            type="button"
            className={`stage-tool-btn ${voiceOpen ? 'active' : ''}`}
            style={{ '--i': 2 } as React.CSSProperties}
            onClick={onVoice}
          >
            Voz
          </button>
          <button
            type="button"
            className="stage-tool-btn"
            style={{ '--i': 3 } as React.CSSProperties}
            onClick={onAnimation}
          >
            Animação
          </button>
          <button
            type="button"
            className={`stage-tool-btn ${layoutOpen ? 'active' : ''}`}
            style={{ '--i': 4 } as React.CSSProperties}
            onClick={onLayout}
          >
            Posição
          </button>
        </div>
      ) : null}
    </div>
  )
}
