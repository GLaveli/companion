import { useAgentStore } from '../agentStore'

export function AgentConfirmDialog(): React.JSX.Element | null {
  const pendingPlan = useAgentStore((s) => s.pendingPlan)
  const confirm = useAgentStore((s) => s.confirm)
  const cancel = useAgentStore((s) => s.cancel)

  if (!pendingPlan?.actions?.length) return null

  return (
    <div className="gallery-overlay agent-overlay" role="presentation">
      <div
        className="gallery-modal agent-modal"
        role="dialog"
        aria-labelledby="agent-dialog-title"
        aria-modal="true"
      >
        <div className="gallery-header">
          <h2 id="agent-dialog-title">Permitir ação no computador?</h2>
          <button type="button" className="gallery-close" onClick={cancel} aria-label="Cancelar">
            ✕
          </button>
        </div>

        <p className="agent-dialog-lead">
          A Lotus quer fazer o seguinte no seu computador. Confirme apenas se você pediu isso.
        </p>

        <ul className="agent-action-list">
          {pendingPlan.actions.map((action) => (
            <li key={action.id}>
              <span className="agent-action-label">{action.label}</span>
              <span className="agent-action-tool">{action.toolId}</span>
            </li>
          ))}
        </ul>

        <div className="agent-dialog-actions">
          <button type="button" className="agent-btn secondary" onClick={cancel}>
            Cancelar
          </button>
          <button type="button" className="agent-btn primary" onClick={confirm}>
            Permitir
          </button>
        </div>
      </div>
    </div>
  )
}
