import { Component, type ErrorInfo, type ReactNode } from 'react'

const RELOADED = 'lanemark:chunk-reload'

/** After a deploy, an open tab can ask for code files that no longer exist. One reload fixes that. */
function isStaleChunk(error: unknown) {
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Failed to fetch/i.test(String((error as Error)?.message ?? error))
}

/**
 * Last line of defence for render errors: a calm page with a way back, instead of a blank screen. Classes are
 * saved on the device as they're edited, so nothing typed is lost by reloading.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
    if (isStaleChunk(error)) {
      let reloaded = false
      try {
        reloaded = sessionStorage.getItem(RELOADED) === '1'
        sessionStorage.setItem(RELOADED, '1')
      } catch {
        /* private mode */
      }
      if (!reloaded) window.location.reload()
    }
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const stale = isStaleChunk(error)
    return (
      <div role="alert" className="flex min-h-dvh items-center justify-center px-6">
        <div className="card max-w-md p-8 text-center">
          <img src="/logo.svg" alt="" width={44} height={44} className="mx-auto" />
          <h1 className="page-title mt-5 !text-[1.8rem]">{stale ? 'Lanemark was updated' : 'Something went wrong'}</h1>
          <p className="mt-3 text-[14.5px] leading-relaxed text-muted">
            {stale
              ? 'A newer version is available. Reload to get it.'
              : 'This screen hit a problem. Your classes are saved on this device, so reloading won’t lose anything.'}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => window.location.reload()} className="btn-primary inline-flex h-11 items-center rounded-full px-6 text-sm">
              Reload
            </button>
            <a href="/app" className="btn-glass inline-flex h-11 items-center rounded-full px-6 text-sm font-medium">
              Go to my classes
            </a>
          </div>
          {!stale && <p className="mt-5 break-words font-mono text-[11.5px] text-dim">{error.message}</p>}
        </div>
      </div>
    )
  }
}
