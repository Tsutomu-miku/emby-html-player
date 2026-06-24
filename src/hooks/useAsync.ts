import { useState, useEffect } from 'react'

export interface AsyncState<T> {
  data?: T
  error?: Error
  loading: boolean
}

/**
 * 简易异步 Hook：在 deps 变更时重新执行 fn。
 * 内置 cancelled flag 与 AbortController（fn 内部可选使用），避免竞态。
 */
export function useAsync<T>(
  fn: (signal?: AbortSignal) => Promise<T>,
  deps: unknown[],
): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ loading: true })

  useEffect(() => {
    let cancelled = false
    const ctrl = new AbortController()

    setState((s) => ({ ...s, loading: true, error: undefined }))

    fn(ctrl.signal)
      .then((d) => {
        if (!cancelled) setState({ data: d, loading: false })
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setState({
            error: e instanceof Error ? e : new Error(String(e)),
            loading: false,
          })
        }
      })

    return () => {
      cancelled = true
      ctrl.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return state
}
