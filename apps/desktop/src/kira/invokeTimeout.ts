// research fix-capture-download-hang 2026-11-10: a native command that never
// resolves or rejects (a panicked Tauri task, for instance) leaves its JS
// invoke() promise pending forever, so any UI driven by that promise — here,
// the capture download progress bar — hangs indeterminately with no way out
// short of restarting the app. withTimeout is a backstop independent of
// whatever the native side does right: it races the real promise against a
// timer and rejects on its own if the timer wins, regardless of why the
// native call never answered.
export class InvokeTimeoutError extends Error {
  constructor(label: string, timeoutMs: number) {
    super(`${label} timed out after ${timeoutMs}ms`)
    this.name = 'InvokeTimeoutError'
  }
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new InvokeTimeoutError(label, timeoutMs)), timeoutMs)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}
