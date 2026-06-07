import { useCallback, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface StatusIndicatorProps {
  label: string
  tooltip: string
  indicatorClass: string
  dotClass: string
}

function placeTooltip(anchor: HTMLElement): { top: number; left: number; width: number } {
  const rect = anchor.getBoundingClientRect()
  const width = Math.min(280, window.innerWidth - 16)
  const gap = 8
  const estHeight = 96

  let left = rect.right - width
  left = Math.max(gap, Math.min(left, window.innerWidth - width - gap))

  let top = rect.bottom + gap
  if (top + estHeight > window.innerHeight - gap) {
    top = rect.top - gap - estHeight
  }
  top = Math.max(gap, Math.min(top, window.innerHeight - estHeight - gap))

  return { top, left, width }
}

/** Status pill with tooltip portaled to document.body — never clipped by panel/stage overflow. */
export function StatusIndicator({
  label,
  tooltip,
  indicatorClass,
  dotClass
}: StatusIndicatorProps): React.JSX.Element {
  const btnRef = useRef<HTMLButtonElement>(null)
  const [tipPos, setTipPos] = useState<{ top: number; left: number; width: number } | null>(null)

  const showTip = useCallback(() => {
    const el = btnRef.current
    if (!el) return
    setTipPos(placeTooltip(el))
  }, [])

  const hideTip = useCallback(() => setTipPos(null), [])

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`llm-indicator ${indicatorClass}`}
        aria-label={tooltip}
        onMouseEnter={showTip}
        onMouseLeave={hideTip}
        onFocus={showTip}
        onBlur={hideTip}
      >
        <span className={`dot ${dotClass}`} aria-hidden="true" />
        <span className="llm-indicator-label">{label}</span>
      </button>
      {tipPos
        ? createPortal(
            <div
              className="llm-indicator-tip llm-indicator-tip--fixed"
              style={{ top: tipPos.top, left: tipPos.left, width: tipPos.width }}
              role="tooltip"
            >
              {tooltip}
            </div>,
            document.body
          )
        : null}
    </>
  )
}
