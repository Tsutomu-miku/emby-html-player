import { useEffect, useRef } from 'react'
import type { PlayMethod } from '@/api/types'
import type { PlayerControl } from '@/components/player/backends/control'

export interface KeyboardShortcutApi {
  video: HTMLVideoElement | null
  control?: PlayerControl
  container: HTMLElement | null
  hasPrev?: boolean
  hasNext?: boolean
  onPrev?: () => void
  onNext?: () => void
  playbackRate: number
  setPlaybackRate: (r: number) => void
  /** 字幕循环切换（关 -> 第一条 -> 第二条… -> 关），external 模式 */
  cycleSubtitles?: () => void
}

/**
 * 播放器全局键盘快捷键：
 *   Space/K → play/pause
 *   ←/→ → ±10s；Shift+←/→ → ±30s
 *   ↑/↓ → volume ±10%
 *   M → mute toggle
 *   F → fullscreen toggle（容器级，避免全屏时控制条不可见）
 *   Esc → 若在全屏则退出
 *   N / P → next / prev track
 *   C → 字幕循环切换
 *   < / > → playbackRate ±0.25
 */
export function useKeyboardShortcuts(api: KeyboardShortcutApi, enabled = true) {
  const apiRef = useRef(api)
  apiRef.current = api

  useEffect(() => {
    if (!enabled) return

    const handler = (e: KeyboardEvent) => {
      // 输入框中不触发
      const target = e.target as HTMLElement | null
      if (target) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return
      }

      const cur = apiRef.current
      const { video, control, container, hasPrev, hasNext, onPrev, onNext, playbackRate, setPlaybackRate, cycleSubtitles } = cur

      const seekRel = (delta: number) => {
        if (control) {
          const dur = control.duration || 0
          const next = Math.max(0, Math.min(dur > 0 ? dur - 0.1 : Infinity, control.currentTime + delta))
          control.seek(next)
          return
        }
        if (!video) return
        const dur = video.duration || 0
        const next = Math.max(0, Math.min(dur > 0 ? dur - 0.1 : Infinity, video.currentTime + delta))
        video.currentTime = next
      }

      const togglePlay = () => {
        if (control) {
          if (control.paused) void control.play()
          else control.pause()
          return
        }
        if (!video) return
        if (video.paused) void video.play().catch((err: unknown) => {
          console.warn('[Player] shortcut play failed', err)
        })
        else video.pause()
      }

      switch (e.key) {
        case ' ':
        case 'k':
        case 'K':
          e.preventDefault()
          togglePlay()
          break
        case 'ArrowLeft':
          e.preventDefault()
          seekRel(e.shiftKey ? -30 : -10)
          break
        case 'ArrowRight':
          e.preventDefault()
          seekRel(e.shiftKey ? 30 : 10)
          break
        case 'ArrowUp':
          e.preventDefault()
          if (control) {
            const v = Math.min(1, control.volume + 0.1)
            control.setVolume(v)
            if (v > 0) control.setMuted(false)
          } else if (video) {
            const v = Math.min(1, video.volume + 0.1)
            video.volume = v
            if (v > 0) video.muted = false
          }
          break
        case 'ArrowDown':
          e.preventDefault()
          if (control) control.setVolume(Math.max(0, control.volume - 0.1))
          else if (video) video.volume = Math.max(0, video.volume - 0.1)
          break
        case 'm':
        case 'M':
          e.preventDefault()
          if (control) control.setMuted(!control.muted)
          else if (video) video.muted = !video.muted
          break
        case 'f':
        case 'F':
          e.preventDefault()
          if (!container) break
          if (!document.fullscreenElement) {
            void container.requestFullscreen?.().catch((err: unknown) => {
              console.warn('[Player] shortcut enter fullscreen failed', err)
            })
          } else {
            void document.exitFullscreen?.().catch((err: unknown) => {
              console.warn('[Player] shortcut exit fullscreen failed', err)
            })
          }
          break
        case 'Escape':
          if (document.fullscreenElement) {
            void document.exitFullscreen?.().catch((err: unknown) => {
              console.warn('[Player] shortcut escape fullscreen failed', err)
            })
          }
          break
        case 'n':
        case 'N':
          if (hasNext && onNext) {
            e.preventDefault()
            onNext()
          }
          break
        case 'p':
        case 'P':
          if (hasPrev && onPrev) {
            e.preventDefault()
            onPrev()
          }
          break
        case 'c':
        case 'C':
          e.preventDefault()
          cycleSubtitles?.()
          break
        case '<':
        case ',':
          e.preventDefault()
          setPlaybackRate(Math.max(0.25, Number((playbackRate - 0.25).toFixed(2))))
          break
        case '>':
        case '.':
          e.preventDefault()
          setPlaybackRate(Math.min(3, Number((playbackRate + 0.25).toFixed(2))))
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [enabled])
}

export type { PlayMethod }
