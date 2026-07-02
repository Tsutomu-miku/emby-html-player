import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Controls } from '@/components/player/Controls'
import type { PlayerControl } from '@/components/player/backends/control'
import type { MediaSourceInfo, MediaStream, PlayMethod } from '@/api/types'
import { MpvStartupStatus } from './mpv-overlay/MpvStartupStatus'
import { useMpvOverlayVisibility } from './mpv-overlay/useMpvOverlayVisibility'
import './MpvOverlayPage.scss'

interface OverlayState {
  title: string
  currentTime: number
  duration: number
  paused: boolean
  muted: boolean
  volume: number
  playbackRate: number
  mediaSources: MediaSourceInfo[]
  currentMediaSourceId?: string
  audioStreams: MediaStream[]
  currentAudioIndex?: number
  subtitleStreams: MediaStream[]
  currentSubtitleIndex: number | null
  playMethod: PlayMethod
  hasPrev: boolean
  hasNext: boolean
  started: boolean
  firstFrameRendered: boolean
  loadingStartedAt: number
  speed: number
  error: string
}

const initialState: OverlayState = {
  title: '',
  currentTime: 0,
  duration: 0,
  paused: true,
  muted: false,
  volume: 1,
  playbackRate: 1,
  mediaSources: [],
  audioStreams: [],
  subtitleStreams: [],
  currentSubtitleIndex: null,
  playMethod: 'DirectPlay',
  hasPrev: false,
  hasNext: false,
  started: false,
  firstFrameRendered: false,
  loadingStartedAt: Date.now(),
  speed: 0,
  error: '',
}

export function MpvOverlayPage() {
  const [state, setState] = useState(initialState)
  const containerRef = useRef<HTMLDivElement>(null)
  const controlsVisibility = useMpvOverlayVisibility(containerRef)
  const setControlsVisible = controlsVisibility.setVisible
  const [now, setNow] = useState(() => Date.now())
  const stateRef = useRef(initialState)
  stateRef.current = state

  useEffect(() => {
    document.documentElement.dataset['mpvOverlay'] = 'true'
    return () => {
      delete document.documentElement.dataset['mpvOverlay']
    }
  }, [])

  useEffect(() => window.ehp.onMpvEvent((event) => {
    switch (event.type) {
      case 'metadata':
        setState((cur) => ({
          ...cur,
          title: event.title ?? cur.title,
          mediaSources: event.mediaSources ?? cur.mediaSources,
          currentMediaSourceId: event.currentMediaSourceId ?? cur.currentMediaSourceId,
          audioStreams: event.audioStreams ?? cur.audioStreams,
          currentAudioIndex: event.currentAudioIndex ?? cur.currentAudioIndex,
          subtitleStreams: event.subtitleStreams ?? cur.subtitleStreams,
          currentSubtitleIndex: event.currentSubtitleIndex ?? cur.currentSubtitleIndex,
          playMethod: event.playMethod ?? cur.playMethod,
          playbackRate: event.playbackRate ?? cur.playbackRate,
          hasPrev: event.hasPrev ?? cur.hasPrev,
          hasNext: event.hasNext ?? cur.hasNext,
        }))
        break
      case 'loading':
        setState((cur) => ({
          ...cur,
          started: false,
          firstFrameRendered: false,
          currentTime: 0,
          duration: 0,
          speed: 0,
          error: '',
          loadingStartedAt: Date.now(),
        }))
        setControlsVisible(true)
        break
      case 'started':
        setState((cur) => ({ ...cur, started: true, paused: false, error: '' }))
        break
      case 'rendered':
        setState((cur) => ({ ...cur, started: true, firstFrameRendered: true, error: '' }))
        break
      case 'time':
        setState((cur) => ({
          ...cur,
          started: true,
          currentTime: event.seconds ?? cur.currentTime,
        }))
        break
      case 'duration':
        setState((cur) => ({
          ...cur,
          started: true,
          duration: event.seconds ?? cur.duration,
        }))
        break
      case 'paused':
        setState((cur) => ({
          ...cur,
          started: event.paused === false ? true : cur.started,
          paused: event.paused ?? cur.paused,
        }))
        break
      case 'network':
        setState((cur) => ({ ...cur, speed: event.bytesPerSecond ?? cur.speed }))
        break
      case 'error':
        setState((cur) => ({ ...cur, error: event.message ?? 'MPV 播放失败' }))
        setControlsVisible(true)
        break
      case 'ready':
      case 'ended':
      case 'log':
      case 'ui-action':
        break
    }
  }), [setControlsVisible])

  useEffect(() => {
    void sendMpvCommand('request-overlay-metadata', [], 'metadata snapshot')
  }, [])

  useEffect(() => {
    if (state.firstFrameRendered || state.error) return
    const timer = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(timer)
  }, [state.error, state.firstFrameRendered])

  const runCommand = useCallback((command: string, args: unknown[], label: string) => {
    return sendMpvCommand(command, args, label)
  }, [])

  const control = useMemo<PlayerControl>(() => ({
    currentTime: state.currentTime,
    duration: state.duration,
    paused: state.paused,
    muted: state.muted,
    volume: state.volume,
    bufferedEnd: state.duration,
    canPictureInPicture: false,
    started: state.started,
    firstFrameRendered: state.firstFrameRendered,
    networkBytesPerSecond: state.speed,
    play: () => runCommand('set-pause', [false], 'play'),
    pause: () => { void runCommand('set-pause', [true], 'pause') },
    seek: (seconds: number) => { void runCommand('seek-absolute', [seconds], 'seek') },
    setVolume: (volume: number) => {
      if (stateRef.current.volume === volume) return
      setState((cur) => cur.volume === volume ? cur : ({ ...cur, volume }))
      void runCommand('set-volume', [Math.round(volume * 100)], 'volume')
    },
    setMuted: (muted: boolean) => {
      if (stateRef.current.muted === muted) return
      setState((cur) => cur.muted === muted ? cur : ({ ...cur, muted }))
      void runCommand('set-muted', [muted], 'mute')
    },
    setPlaybackRate: (rate: number) => {
      if (stateRef.current.playbackRate === rate) return
      setState((cur) => cur.playbackRate === rate ? cur : ({ ...cur, playbackRate: rate }))
      void runCommand('set-rate', [rate], 'rate')
    },
    setAudioTrack: (index: number) => {
      void runCommand('set-audio-track', [index], 'audio track')
    },
    setSubtitleTrack: (index: number | null) => {
      void runCommand('set-subtitle-track', [index ?? -1], 'subtitle track')
    },
  }), [runCommand, state])

  const speedText = formatSpeed(state.speed)

  return (
    <div
      ref={containerRef}
      className="mpv-overlay"
      onPointerEnter={controlsVisibility.onPointerEnter}
      onPointerMove={controlsVisibility.onPointerMove}
      onPointerLeave={controlsVisibility.onPointerLeave}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          if (state.paused) void control.play()
          else control.pause()
        }
      }}
    >
      {!state.firstFrameRendered && !state.error ? (
        <MpvStartupStatus
          currentTime={state.currentTime}
          elapsedSeconds={Math.max(0, (now - state.loadingStartedAt) / 1000)}
          fileLoaded={state.started}
          speed={state.speed}
        />
      ) : null}

      {!state.firstFrameRendered ? (
        <div className="mpv-overlay__loading">
          <div className="mpv-overlay__spinner" />
          <div>{speedText ? `媒体数据接收中：${speedText}` : '正在等待媒体数据…'}</div>
        </div>
      ) : null}

      {state.error ? <div className="mpv-overlay__error">{state.error}</div> : null}

      <Controls
        video={null}
        control={control}
        container={containerRef.current}
        item={{ name: state.title }}
        mediaSources={state.mediaSources}
        currentMediaSourceId={state.currentMediaSourceId}
        onMediaSourceChange={(id) => sendOverlayAction('media-source', id)}
        audioStreams={state.audioStreams}
        currentAudioIndex={state.currentAudioIndex}
        onAudioChange={(index) => control.setAudioTrack?.(index)}
        subtitleStreams={state.subtitleStreams}
        currentSubtitleIndex={state.currentSubtitleIndex}
        onSubtitleChange={(index) => control.setSubtitleTrack?.(index)}
        playbackRate={state.playbackRate}
        onPlaybackRateChange={control.setPlaybackRate}
        hasPrev={state.hasPrev}
        hasNext={state.hasNext}
        onPrev={() => sendOverlayAction('prev')}
        onNext={() => sendOverlayAction('next')}
        show={controlsVisibility.visible}
        playMethod={state.playMethod}
        onBack={() => sendOverlayAction('back')}
      />
    </div>
  )
}

function sendOverlayAction(action: 'back' | 'prev' | 'next' | 'media-source', value?: string) {
  void window.ehp.mpvCommand({
    command: 'overlay-action',
    args: [{ action, value }],
  }).catch((err: unknown) => {
    console.warn(`[PlayerOverlay] ${action} failed`, err)
  })
}

function sendMpvCommand(command: string, args: unknown[], label: string) {
  return window.ehp.mpvCommand({ command, args }).catch((err: unknown) => {
    console.warn(`[PlayerOverlay] ${label} failed`, err)
  })
}

function formatSpeed(bytesPerSecond: number) {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return ''
  if (bytesPerSecond >= 1024 * 1024) return `${(bytesPerSecond / 1024 / 1024).toFixed(1)} MB/s`
  if (bytesPerSecond >= 1024) return `${Math.round(bytesPerSecond / 1024)} KB/s`
  return `${Math.round(bytesPerSecond)} B/s`
}
