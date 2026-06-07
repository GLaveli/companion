import { useEffect, useRef } from 'react'
import { useStore } from '../store'

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

export function DevLogPanel(): React.JSX.Element {
  const devLogs = useStore((s) => s.devLogs)
  const devLogOpen = useStore((s) => s.devLogOpen)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [devLogs])

  return (
    <section className="dev-log-panel" aria-label="Log de atividade">
      <header className="dev-log-header">
        <button
          type="button"
          className="dev-log-toggle"
          onClick={() => useStore.getState().setDevLogOpen(!devLogOpen)}
        >
          {devLogOpen ? '▼' : '▶'} Log ({devLogs.length})
        </button>
        <button
          type="button"
          className="dev-log-clear"
          onClick={() => useStore.getState().clearDevLogs()}
          title="Limpar log"
        >
          Limpar
        </button>
      </header>
      {devLogOpen ? (
        <div className="dev-log-list" ref={listRef}>
          {devLogs.length === 0 ? (
            <p className="dev-log-empty">Aguardando atividade…</p>
          ) : (
            devLogs.map((entry, i) => (
              <div key={`${entry.ts}-${i}`} className="dev-log-line">
                <span className="dev-log-time">{formatTime(entry.ts)}</span>
                <span className="dev-log-source">{entry.source}</span>
                <span className="dev-log-message">{entry.message}</span>
                {entry.detail ? <span className="dev-log-detail">{entry.detail}</span> : null}
              </div>
            ))
          )}
        </div>
      ) : null}
    </section>
  )
}
