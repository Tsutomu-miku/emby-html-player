// 控制条可见性 hook：mousemove / keydown / play / pause 触发显示，2.5s 静止隐藏
import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { debounce } from '@/utils'
import type { PlayerControl } from '../backends/control'

export function useControlsVisibility(
  videoRef: RefObject<HTMLVideoElement | null>,
  containerRef: RefObject<HTMLDivElement | null>,
  controlRef?: RefObject<PlayerControl | undefined>,
) {
  const [controlsVisible, setControlsVisible] = useState(true)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => {
      const v = videoRef.current
      const control = controlRef?.current
      if ((v && !v.paused) || (control && !control.paused)) setControlsVisible(false)
    }, 2500)
  }, [controlRef, videoRef])

  const bumpVisibility = useCallback(() => {
    setControlsVisible(true)
    scheduleHide()
  }, [scheduleHide])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onMove = debounce(() => bumpVisibility(), 100)
    const onLeave = () => {
      const v = videoRef.current
      const control = controlRef?.current
      if ((v && !v.paused) || (control && !control.paused)) {
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
        hideTimerRef.current = setTimeout(() => setControlsVisible(false), 1500)
      }
    }
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('[data-player-controls]')) return
      const control = controlRef?.current
      if (control) {
        if (control.paused) void control.play()
        else control.pause()
        return
      }
      if (t.tagName === 'VIDEO') {
        const v = videoRef.current
        if (v) { if (v.paused) void v.play().catch(() => {}); else v.pause() }
      }
    }
    const onTouchEnd = (e: TouchEvent) => {
      const t = e.target as HTMLElement
      if (t.tagName === 'VIDEO') setControlsVisible((v) => !v)
    }
    const onKey = () => bumpVisibility()
    el.addEventListener('mousemove', onMove as unknown as EventListener)
    el.addEventListener('mouseleave', onLeave)
    el.addEventListener('click', onClick)
    el.addEventListener('touchend', onTouchEnd)
    window.addEventListener('keydown', onKey)
    return () => {
      el.removeEventListener('mousemove', onMove as unknown as EventListener)
      el.removeEventListener('mouseleave', onLeave)
      el.removeEventListener('click', onClick)
      el.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('keydown', onKey)
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [bumpVisibility, containerRef, controlRef, videoRef])

  return { controlsVisible, bumpVisibility }
}
