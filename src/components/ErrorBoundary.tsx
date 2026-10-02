import { Component, type ErrorInfo, type ReactNode } from 'react'

/** Catches a render-time crash anywhere in the tree and shows a recoverable
 *  message instead of a blank white screen — the dashboard is one person's
 *  working tool, so a single bad render shouldn't lock them out of everything. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Dashboard render error:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: 24 }}>
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <h1 style={{ fontFamily: 'var(--font-title)', fontSize: 20, marginBottom: 8 }}>
            Something went wrong
          </h1>
          <p style={{ color: 'var(--ink-muted)', marginBottom: 20 }}>
            The page hit an unexpected error. Reloading usually clears it.
          </p>
          <button className="btn btn--primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </div>
    )
  }
}
