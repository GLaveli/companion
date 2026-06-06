import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  label?: string
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[ui] ${this.props.label ?? 'render'} crashed:`, error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="error-fallback">
          <strong>Algo deu errado ao carregar a interface.</strong>
          <p>{this.state.error.message}</p>
          <button type="button" onClick={() => this.setState({ error: null })}>
            Tentar de novo
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
