import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-surface flex items-center justify-center px-4">
          <div className="bg-surface-container rounded-card border border-danger p-6 max-w-sm w-full">
            <p className="text-sm font-semibold text-danger mb-1">Fehler beim Laden</p>
            <p className="text-xs text-ink-muted font-mono break-all">{this.state.error.message}</p>
            <button
              className="mt-4 text-sm text-primary underline"
              onClick={() => window.location.reload()}
            >
              Seite neu laden
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
