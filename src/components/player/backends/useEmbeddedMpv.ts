import { useEffect, useMemo, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
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
  firstFrameRendered: false,
  networkBytesPerSecond: 0,
}

const START_TIMEOUT_MS = 30_000

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
    const bounds = readBounds(containerRef.current)
    let cancelled = false
    let startSeekPending = startSeconds > 0
    let playbackStarted = false
    let startTimeout: number | undefined = window.setTimeout(() => {
      if (cancelled || playbackStarted) return
      latestRef.current.onError('MPV 30 秒内没有开始播放：资源响应过慢、链接过期或服务器拒绝了媒体请求')
    }, START_TIMEOUT_MS)
    const clearStartTimeout = () => {
      if (startTimeout === undefined) return
      window.clearTimeout(startTimeout)
      startTimeout = undefined
    }
    const markStarted = () => {
      playbackStarted = true
      clearStartTimeout()
    }
    createdRef.current = false
    setState({ ...initialState, currentTime: startSeconds, duration: initialDurationSeconds })

    const unsubscribe = window.ehp.onMpvEvent((event) => {
      if (cancelled) return
      if (event.type === 'log') return
      switch (event.type) {
        case 'loading':
          playbackStarted = false
          setState({ ...initialState, currentTime: startSeconds, duration: initialDurationSeconds })
          break
        case 'started':
          markStarted()
          setState((cur) => ({ ...cur, started: true, paused: false }))
          if (startSeekPending) {
            startSeekPending = false
            void window.ehp.mpvCommand({ command: 'seek-absolute', args: [startSeconds] }).catch((err: unknown) => {
              console.warn('[Player] mpv start seek failed', err)
            })
          }
          latestRef.current.onStarted?.()
          break
        case 'rendered':
          markStarted()
          setState((cur) => ({ ...cur, started: true, firstFrameRendered: true }))
          break
        case 'time':
          markStarted()
          setState((cur) => ({ ...cur, started: true, currentTime: event.seconds ?? cur.currentTime }))
          break
        case 'duration':
          markStarted()
          setState((cur) => ({ ...cur, started: true, duration: event.seconds ?? cur.duration }))
          break
        case 'paused':
          if (event.paused === false) markStarted()
          setState((cur) => ({ ...cur, started: event.paused === false ? true : cur.started, paused: event.paused ?? cur.paused }))
          break
        case 'network':
          setState((cur) => ({ ...cur, networkBytesPerSecond: event.bytesPerSecond ?? cur.networkBytesPerSecond }))
          break
        case 'ended':
          clearStartTimeout()
          latestRef.current.onEnded?.()
          break
        case 'error':
          clearStartTimeout()
          latestRef.current.onError(event.message ?? 'MPV 播放失败')
          break
        case 'ready':
        case 'metadata':
        case 'ui-action':
          break
      }
    })

    void window.ehp.mpvCreate({ bounds, itemId })
      .then(() => {
        if (cancelled) return undefined
        createdRef.current = true
        void window.ehp.mpvCommand({
          command: 'set-bounds',
          args: [readBounds(containerRef.current)],
        }).catch((err: unknown) => {
          console.warn('[Player] mpv initial bounds failed', err)
        })
        return window.ehp.mpvLoad({ url, title, startSeconds })
      })
      .then(() => {
        if (cancelled) return undefined
        return window.ehp.mpvCommand({ command: 'set-rate', args: [playbackRateRef.current] })
      })
      .catch((err: unknown) => {
        clearStartTimeout()
        createdRef.current = false
        latestRef.current.onError(err instanceof Error ? err.message : String(err))
      })

    return () => {
      cancelled = true
      clearStartTimeout()
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
      const bounds = readBounds(containerRef.current)
      void window.ehp.mpvCommand({ command: 'set-bounds', args: [bounds] }).catch((err: unknown) => {
        console.warn('[Player] mpv resize failed', err)
      })
    }
    let frame = 0
    const scheduleResize = () => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        resize()
      })
    }
    const observer = new ResizeObserver(resize)
    const element = containerRef.current
    if (element) observer.observe(element)
    window.addEventListener('resize', scheduleResize)
    window.addEventListener('scroll', scheduleResize, true)
    window.visualViewport?.addEventListener('resize', scheduleResize)
    window.visualViewport?.addEventListener('scroll', scheduleResize)
    resize()
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', scheduleResize)
      window.removeEventListener('scroll', scheduleResize, true)
      window.visualViewport?.removeEventListener('resize', scheduleResize)
      window.visualViewport?.removeEventListener('scroll', scheduleResize)
    }
  }, [containerRef, enabled])

  return useMemo(
    () => createMpvControl(enabled, state, setState, createdRef),
    [enabled, state],
  )
}

type SetMpvState = Dispatch<SetStateAction<MpvPlaybackState>>

function createMpvControl(
  enabled: boolean,
  state: MpvPlaybackState,
  setState: SetMpvState,
  createdRef: { current: boolean },
): PlayerControl | undefined {
  if (!enabled) return undefined
  return {
    currentTime: state.currentTime,
    duration: state.duration,
    paused: state.paused,
    muted: state.muted,
    volume: state.volume,
    started: state.started,
    firstFrameRendered: state.firstFrameRendered,
    networkBytesPerSecond: state.networkBytesPerSecond,
    bufferedEnd: state.duration,
    canPictureInPicture: false,
    play: () => sendMpvCommand(createdRef, 'set-pause', [false], 'play'),
    pause: () => { void sendMpvCommand(createdRef, 'set-pause', [true], 'pause') },
    seek: (seconds: number) => { void sendMpvCommand(createdRef, 'seek-absolute', [seconds], 'seek') },
    setVolume: (volume: number) => {
      setState((cur) => ({ ...cur, volume }))
      void sendMpvCommand(createdRef, 'set-volume', [Math.round(volume * 100)], 'volume')
    },
    setMuted: (muted: boolean) => {
      setState((cur) => ({ ...cur, muted }))
      void sendMpvCommand(createdRef, 'set-muted', [muted], 'mute')
    },
    setPlaybackRate: (rate: number) => { void sendMpvCommand(createdRef, 'set-rate', [rate], 'rate') },
    setAudioTrack: (index: number) => {
      void sendMpvCommand(createdRef, 'set-audio-track', [index], 'audio track')
    },
    setSubtitleTrack: (index: number | null) => {
      void sendMpvCommand(createdRef, 'set-subtitle-track', [index ?? -1], 'subtitle track')
    },
  }
}

function sendMpvCommand(
  createdRef: { current: boolean },
  command: string,
  args: unknown[],
  label: string,
) {
  if (!createdRef.current) return undefined
  return window.ehp.mpvCommand({ command, args }).catch((err: unknown) => {
    console.warn(`[Player] mpv ${label} failed`, err)
  })
}

function readBounds(element: HTMLElement | null): MpvBounds {
  if (!element) return { x: 0, y: 0, width: 1, height: 1 }
  const rect = element.getBoundingClientRect()
  return {
    x: Math.round(rect.left),
    y: Math.round(rect.top),
    width: Math.max(1, Math.round(rect.width)),
    height: Math.max(1, Math.round(rect.height)),
  }
}
