import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

type Props = { children: ReactNode }

type State = { hasError: boolean; message: string }

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'Something went wrong.' }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 py-20 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary-400/90">Error</p>
          <h1 className="mt-3 font-display text-3xl font-normal tracking-tight text-white">
            Something broke
          </h1>
          <p className="mt-4 text-sm text-slate-400">
            The app hit an unexpected error. You can try again or return home.
          </p>
          {import.meta.env.DEV && this.state.message && (
            <pre className="mt-6 max-h-40 w-full overflow-auto rounded-xl bg-slate-900/80 p-4 text-left text-xs text-red-200/90 ring-1 ring-white/10">
              {this.state.message}
            </pre>
          )}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => globalThis.location.reload()}
              className="rounded-full bg-primary-600 px-8 py-3 text-sm font-semibold text-white hover:bg-primary-500"
            >
              Reload page
            </button>
            <Link
              to="/"
              className="rounded-full border border-white/15 px-8 py-3 text-sm font-semibold text-slate-200 hover:border-white/25 hover:text-white"
            >
              Home
            </Link>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
