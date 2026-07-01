import { useEffect, type RefObject } from 'react'

interface BindingOptions {
  hasPrev?: boolean
  hasNext?: boolean
  onPrev?: () => void
  onNext?: () => void
}

interface UsePlayerEpisodeBindingsParams {
  containerRef: RefObject<HTMLDivElement | null>
  itemId: string
  setHasPrev: (value: boolean) => void
  setHasNext: (value: boolean) => void
  prevHandlerRef: RefObject<(() => void) | undefined>
  nextHandlerRef: RefObject<(() => void) | undefined>
}

type PlayerElement = HTMLDivElement & {
  __playerBindHandlers?: (options: BindingOptions) => void
}

export function usePlayerEpisodeBindings(params: UsePlayerEpisodeBindingsParams): void {
  const {
    containerRef,
    itemId,
    setHasPrev,
    setHasNext,
    prevHandlerRef,
    nextHandlerRef,
  } = params
  useEffect(() => {
    const el: PlayerElement | null = containerRef.current
    if (!el) return
    el.__playerBindHandlers = (options) => {
      if (options.hasPrev !== undefined) setHasPrev(options.hasPrev)
      if (options.hasNext !== undefined) setHasNext(options.hasNext)
      if (options.onPrev !== undefined) prevHandlerRef.current = options.onPrev
      if (options.onNext !== undefined) nextHandlerRef.current = options.onNext
    }
    el.dispatchEvent(new CustomEvent('player-ready', { detail: { itemId } }))
  }, [containerRef, itemId, setHasPrev, setHasNext, prevHandlerRef, nextHandlerRef])
}
