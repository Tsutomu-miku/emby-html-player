import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react'

interface UseMpvOverlayVisibilityResult {
  visible: boolean
  setVisible: (visible: boolean) => void
  interactive: boolean
  onPointerEnter: () => void
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void
  onPointerLeave: (event: PointerEvent<HTMLDivElement>) => void
}

export function useMpvOverlayVisibility(
  containerRef: RefObject<HTMLElement | null>,
): UseMpvOverlayVisibilityResult {
  const [visible, setVisibleState] = useState(true)
  const [interactive, setInteractiveState] = useState(false)
  const hideTimerRef = useRef<number | undefined>(undefined)
  const pointerRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => () => clearHideTimer(hideTimerRef), [])
  useEffect(() => {
    void window.ehp.mpvCommand({
      command: 'set-overlay-interactive',
      args: [interactive],
    }).catch((err: unknown) => {
      console.warn('[PlayerOverlay] interaction mode failed', err)
    })
  }, [interactive])

  const setVisible = useCallback((nextVisible: boolean) => {
    setVisibleState((cur) => cur === nextVisible ? cur : nextVisible)
  }, [])
  const setInteractive = useCallback((nextInteractive: boolean) => {
    setInteractiveState((cur) => cur === nextInteractive ? cur : nextInteractive)
  }, [])

  const keepVisible = () => {
    setVisible(true)
    setInteractive(true)
    clearHideTimer(hideTimerRef)
  }

  const scheduleHide = (options?: { checkPointer: boolean }) => {
    clearHideTimer(hideTimerRef)
    hideTimerRef.current = window.setTimeout(() => {
      if (options?.checkPointer && isPointOverControls(containerRef.current, pointerRef.current)) {
        keepVisible()
        return
      }
      setVisible(false)
      setInteractive(false)
      hideTimerRef.current = undefined
    }, 2500)
  }

  const showThenScheduleHide = () => {
    setVisible(true)
    setInteractive(false)
    scheduleHide({ checkPointer: true })
  }

  return {
    visible,
    setVisible,
    interactive,
    onPointerEnter: showThenScheduleHide,
    onPointerMove: (event) => {
      pointerRef.current = { x: event.clientX, y: event.clientY }
      if (isPointerOverControls(event)) keepVisible()
      else showThenScheduleHide()
    },
    onPointerLeave: (event) => {
      const nextTarget = event.relatedTarget
      if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return
      pointerRef.current = null
      scheduleHide({ checkPointer: false })
    },
  }
}

function clearHideTimer(hideTimerRef: RefObject<number | undefined>): void {
  if (!hideTimerRef.current) return
  window.clearTimeout(hideTimerRef.current)
  hideTimerRef.current = undefined
}

function isPointerOverControls(event: PointerEvent<HTMLDivElement>): boolean {
  const target = event.target
  if (target instanceof Element && target.closest('[data-player-controls], [data-player-menu]')) {
    return true
  }
  return isPointOverControls(event.currentTarget, { x: event.clientX, y: event.clientY })
}

function isPointOverControls(container: HTMLElement | null, point: { x: number; y: number } | null): boolean {
  if (!container || !point) return false
  return Array.from(container.querySelectorAll('[data-player-controls]')).some((element) => {
    const rect = element.getBoundingClientRect()
    return (
      point.x >= rect.left &&
      point.x <= rect.right &&
      point.y >= rect.top &&
      point.y <= rect.bottom
    )
  })
}
