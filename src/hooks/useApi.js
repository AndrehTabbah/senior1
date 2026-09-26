import { useEffect, useState } from 'react'

/**
 * Small data-fetching hook with abort support.
 *   const { data, error, loading, reload } = useApi(signal => api.sources({ signal }), [])
 */
export function useApi(fetcher, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const ctrl = new AbortController()
    let alive = true
    setState((s) => ({ ...s, loading: true, error: null }))
    Promise.resolve()
      .then(() => fetcher(ctrl.signal))
      .then((data) => alive && setState({ data, error: null, loading: false }))
      .catch((error) => {
        if (!alive || error?.name === 'AbortError') return
        setState({ data: null, error, loading: false })
      })
    return () => {
      alive = false
      ctrl.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  return { ...state, reload: () => setTick((t) => t + 1) }
}
