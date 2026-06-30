import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type { PlayerControl, MpvPlaybackState } from './control'

interface MpvBounds {
  x: number
  y: number
  width: number
  height: number
}

interface UseEmbeddedMpvParams {
  enabled: boolean
  containerRef: RefObject<HTMLElement | null>
  itemId: string
  url?: string
  title?: string
  startSeconds: number
  initialDurationSeconds: number
  playbackRate: number
  controlsVisible: boolean
  onEnded?: () => void
  onError: (message: string) => void
  onStarted?: () => void
}

const initialState: MpvPlaybackState = {
  currentTime: 0,
  duration: 0,
  paused: true,
  muted: false,
  volume: 1,
  started: false,
}

export function useEmbeddedMpv(params: UseEmbeddedMpvParams): PlayerControl | undefined {
  const {
    enabled,
    containerRef,
    itemId,
    url,
    title,
    startSeconds,
    initialDurationSeconds,
    playbackRate,
    controlsVisible,
    onEnded,
    onError,
    onStarted,
  } = params
  const [state, setState] = useState<MpvPlaybackState>(initialState)
  const latestRef = useRef({ onEnded, onError, onStarted })
  const playbackRateRef = useRef(playbackRate)
  const createdRef = useRef(false)
  latestRef.current = { onEnded, onError, onStarted }
  playbackRateRef.current = playbackRate

  useEffect(() => {
    if (!enabled || !url) return
    const bounds = readBounds(containerRef.current, true)
    let cancelled = false
    let startSeekPending = startSeconds > 0
    createdRef.current = false
    setState({ ...initialState, currentTime: startSeconds, duration: initialDurationSeconds })

    const unsubscribe = window.ehp.onMpvEvent((event) => {
      if (cancelled) return
      if (event.type === 'log') return
      switch (event.type) {
        case 'started':
          setState((cur) => ({ ...cur, started: true, paused: false }))
          if (startSeekPending) {
            startSeekPending = false
            void window.ehp.mpvCommand({ command: 'seek-absolute', args: [startSeconds] }).catch((err: unknown) => {
              console.warn('[Player] mpv start seek failed', err)
            })
          }
          latestRef.current.onStarted?.()
          break
        case 'time':
          setState((cur) => ({ ...cur, currentTime: event.seconds ?? cur.currentTime }))
          break
        case 'duration':
          setState((cur) => ({ ...cur, duration: event.seconds ?? cur.duration }))
          break
        case 'paused':
          setState((cur) => ({ ...cur, paused: event.paused ?? cur.paused }))
          break
        case 'ended':
          latestRef.current.onEnded?.()
          break
        case 'error':
          latestRef.current.onError(event.message ?? 'MPV 播放失败')
          break
        case 'ready':
          break
      }
    })

    void window.ehp.mpvCreate({ bounds, itemId })
      .then(() => {
        if (cancelled) return undefined
        createdRef.current = true
        return window.ehp.mpvLoad({ url, title, startSeconds })
      })
      .then(() => {
        if (cancelled) return undefined
        return window.ehp.mpvCommand({ command: 'set-rate', args: [playbackRateRef.current] })
      })
      .catch((err: unknown) => {
        createdRef.current = false
        latestRef.current.onError(err instanceof Error ? err.message : String(err))
      })

    return () => {
      cancelled = true
      createdRef.current = false
      unsubscribe()
      void window.ehp.mpvDestroy().catch((err: unknown) => {
        console.warn('[Player] mpv destroy failed', err)
      })
    }
  }, [containerRef, enabled, initialDurationSeconds, itemId, startSeconds, title, url])

  useEffect(() => {
    if (!enabled) return
    const resize = () => {
      if (!createdRef.current) return
      const bounds = readBounds(containerRef.current, controlsVisible)
      void window.ehp.mpvCommand({ command: 'set-bounds', args: [bounds] }).catch((err: unknown) => {
        console.warn('[Player] mpv resize failed', err)
      })
    }
    const observer = new ResizeObserver(resize)
    const element = containerRef.current
    if (element) observer.observe(element)
    window.addEventListener('resize', resize)
    resize()
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', resize)
    }
  }, [containerRef, controlsVisible, enabled])

  return useMemo(() => {
    if (!enabled) return undefined
    return {
      currentTime: state.currentTime,
      duration: state.duration,
      paused: state.paused,
      muted: state.muted,
      volume: state.volume,
      started: state.started,
      bufferedEnd: state.duration,
      canPictureInPicture: false,
      play: () => {
        if (!createdRef.current) return
        return window.ehp.mpvCommand({ command: 'set-pause', args: [false] }).catch((err: unknown) => {
          console.warn('[Player] mpv play failed', err)
        })
      },
      pause: () => {
        if (!createdRef.current) return
        void window.ehp.mpvCommand({ command: 'set-pause', args: [true] }).catch((err: unknown) => {
          console.warn('[Player] mpv pause failed', err)
        })
      },
      seek: (seconds: number) => {
        if (!createdRef.current) return
        void window.ehp.mpvCommand({ command: 'seek-absolute', args: [seconds] }).catch((err: unknown) => {
          console.warn('[Player] mpv seek failed', err)
        })
      },
      setVolume: (volume: number) => {
        setState((cur) => ({ ...cur, volume }))
        if (!createdRef.current) return
        void window.ehp.mpvCommand({ command: 'set-volume', args: [Math.round(volume * 100)] }).catch((err: unknown) => {
          console.warn('[Player] mpv volume failed', err)
        })
      },
      setMuted: (muted: boolean) => {
        setState((cur) => ({ ...cur, muted }))
        if (!createdRef.current) return
        void window.ehp.mpvCommand({ command: 'set-muted', args: [muted] }).catch((err: unknown) => {
          console.warn('[Player] mpv mute failed', err)
        })
      },
      setPlaybackRate: (rate: number) => {
        if (!createdRef.current) return
        void window.ehp.mpvCommand({ command: 'set-rate', args: [rate] }).catch((err: unknown) => {
          console.warn('[Player] mpv rate failed', err)
        })
      },
      setAudioTrack: (index: number) => {
        if (!createdRef.current) return
        void window.ehp.mpvCommand({ command: 'set-audio-track', args: [index] }).catch((err: unknown) => {
          console.warn('[Player] mpv audio track failed', err)
        })
      },
      setSubtitleTrack: (index: number | null) => {
        if (!createdRef.current) return
        void window.ehp.mpvCommand({ command: 'set-subtitle-track', args: [index ?? -1] }).catch((err: unknown) => {
          console.warn('[Player] mpv subtitle track failed', err)
        })
      },
    }
  }, [enabled, state])
}

function readBounds(element: HTMLElement | null, controlsVisible: boolean): MpvBounds {
  if (!element) return { x: 0, y: 0, width: 1, height: 1 }
  const rect = element.getBoundingClientRect()
  const topInset = controlsVisible ? 56 : 0
  const bottomInset = controlsVisible ? 118 : 0
  const height = Math.max(1, Math.round(rect.height) - topInset - bottomInset)
  return {
    x: Math.round(rect.left),
    y: Math.round(rect.top) + topInset,
    width: Math.max(1, Math.round(rect.width)),
    height,
  }
}
