/* eslint-disable max-lines -- Player 主组件仍负责后端选择、控制条接线、快捷键与渲染组合；
   继续拆分会把同一播放页面的事件流拆散。 */
/* eslint-disable max-lines-per-function -- 完整 React 组件函数承载渲染 + 状态绑定，
   拆分函数会割裂"状态 → 副作用 → JSX"的单一可读流，违反功能解耦优先的重构原则。 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BaseItemDto, MediaStream, PlayMethod } from '@/api/types'
import { useAuthStore } from '@/store/auth'
import { useSettingsStore } from '@/store/settings'
import { cx } from '@/utils'
import { ticksToSeconds } from '@/utils/time'
import { Controls } from './Controls'
import { usePlaybackReporting } from '@/hooks/usePlaybackReporting'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useMediaSession } from '@/hooks/useMediaSession'
import { filterStreams, isTextSubtitle } from './parts/selectors'
import { applySubtitleFontScale, syncTextTrackMode } from './parts/subtitles'
import { useIntroSkip } from './parts/useIntroSkip'
import { useControlsVisibility } from './parts/useControlsVisibility'
import { usePlayerEpisodeBindings } from './parts/usePlayerEpisodeBindings'
import { usePlayerSettings } from './parts/usePlayerSettings'
import { OverlayError, OverlayLoading } from './parts/overlays'
import { useVideoSource } from './parts/useVideoSource'
import { useTranscodeFallback } from './parts/useTranscodeFallback'
import { useEmbeddedMpv } from './backends/useEmbeddedMpv'
import { useMpvOverlayActions } from './backends/useMpvOverlayActions'
import { useMpvOverlayMetadata } from './backends/useMpvOverlayMetadata'
import { useMpvReporting } from './backends/useMpvReporting'
import { usePlayerLoader } from './parts/usePlayerLoader'
import { StatsOverlay } from './parts/StatsOverlay'
import { usePlaybackStats } from './parts/usePlaybackStats'

export interface PlayerProps {
  itemId: string
  startPositionTicks?: number
  seriesId?: string
  defaultAudioIndex?: number
  /** null = 关闭字幕；undefined = 选默认字幕 */
  defaultSubtitleIndex?: number | null
  defaultMediaSourceId?: string
  loadingItem?: BaseItemDto | null
  className?: string
  onEnded?: () => void
  onBeforeEnded?: (secondsLeft: number) => void
  beforeEndedThresholdSeconds?: number
  children?: React.ReactNode
}

export function Player(props: PlayerProps) {
  const {
    itemId, startPositionTicks, seriesId, defaultAudioIndex,
    defaultSubtitleIndex, defaultMediaSourceId, loadingItem, className,
    onEnded, onBeforeEnded, beforeEndedThresholdSeconds = 40, children,
  } = props

  const userId = useAuthStore((s) => s.userId)

  const {
    setSettings, rememberPlaybackRate, subtitleFontScale, enableIntroSkip,
    introSkipStartSeconds, introSkipEndSeconds, introSkipUseKeywordDetect,
    enableCreditsSkip, creditsSkipThresholdSeconds, readSettings,
  } = usePlayerSettings()

  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<import('hls.js').default | null>(null)
  const liveStreamIdRef = useRef<string | undefined>(undefined)
  const mpvControlRef = useRef<ReturnType<typeof useEmbeddedMpv>>(undefined)
  const [toast, setToast] = useState<string | null>(null)
  const [playbackRate, setPlaybackRate] = useState<number>(() => {
    const st = useSettingsStore.getState()
    return st.rememberPlaybackRate ? (st.defaultPlaybackRate ?? 1) : 1
  })
  const [hasPrev, setHasPrev] = useState(false)
  const [hasNext, setHasNext] = useState(false)
  const prevHandlerRef = useRef<(() => void) | undefined>(undefined)
  const nextHandlerRef = useRef<(() => void) | undefined>(undefined)
  void seriesId

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 2500)
  }, [])

  const { reset: resetIntroSkip } = useIntroSkip({
    videoRef, hasNext, showToast,
    onNearEnd: () => onBeforeEnded?.(0),
    nearEndThreshold: beforeEndedThresholdSeconds,
    enableIntroSkip,
    introSkipStartSeconds,
    introSkipEndSeconds,
    introSkipUseKeywordDetect,
    enableCreditsSkip,
    creditsSkipThresholdSeconds,
  })

  const loader = usePlayerLoader({
    itemId,
    userId,
    startPositionTicks,
    defaultMediaSourceId,
    defaultAudioIndex,
    defaultSubtitleIndex,
    readSettings,
    resetIntroSkip,
  })
  const {
    loadState, setLoadState, error, setError, playbackInfoMediaSources,
    selectedMediaSource, selectedAudioIndex, setSelectedAudioIndex,
    selectedSubtitleIndex, setSelectedSubtitleIndex, playMethod, currentUrl,
    liveStreamId, playSessionId, playbackBackend, resolvedStartTicks,
    itemInfo, doLoad,
  } = loader

  useEffect(() => {
    if (!itemId || !userId) return
    void doLoad()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, userId])

  const { controlsVisible } = useControlsVisibility(videoRef, containerRef, mpvControlRef)

  const handleMediaSourceChange = useCallback((id: string) => {
    const resumeSec = videoRef.current?.currentTime ?? 0
    void doLoad({ newMediaSourceId: id, overrideAudioIndex: selectedAudioIndex, overrideSubtitleIndex: selectedSubtitleIndex, resumeSeconds: resumeSec })
  }, [doLoad, selectedAudioIndex, selectedSubtitleIndex, videoRef])

  const handleAudioChange = useCallback((index: number) => {
    if (playbackBackend === 'mpv') {
      const audios = selectedMediaSource ? filterStreams(selectedMediaSource.mediaStreams, 'Audio') : []
      const mpvTrackId = audios.findIndex((stream) => stream.index === index) + 1
      if (mpvTrackId <= 0) return
      setSelectedAudioIndex(index)
      mpvControlRef.current?.setAudioTrack?.(mpvTrackId)
      return
    }
    if (playMethod === 'Transcode') {
      const resumeSec = videoRef.current?.currentTime ?? 0
      setSelectedAudioIndex(index)
      void doLoad({ overrideAudioIndex: index, overrideSubtitleIndex: selectedSubtitleIndex, resumeSeconds: resumeSec })
      return
    }
    type AudioTrackListLike = { length: number; [i: number]: { enabled: boolean; language?: string } }
    type VideoWithAudioTracks = HTMLVideoElement & { audioTracks?: AudioTrackListLike }
    const v: VideoWithAudioTracks | null = videoRef.current
    if (v && v.audioTracks && typeof v.audioTracks === 'object') {
      const audios = selectedMediaSource ? filterStreams(selectedMediaSource.mediaStreams, 'Audio') : []
      const targetStream = audios.find((s) => s.index === index)
      if (v.audioTracks.length > 0 && targetStream) {
        let changed = false
        for (let i = 0; i < v.audioTracks.length; i++) {
          const t = v.audioTracks[i]
          const isMatch = !!(t.language && targetStream.language && t.language.toLowerCase() === targetStream.language.toLowerCase())
          t.enabled = !isMatch ? false : (changed = true, true)
        }
        if (changed) { setSelectedAudioIndex(index); return }
      }
    }
    setSelectedAudioIndex(index)
    showToast('当前播放源不支持切换音轨，尝试切换到转码源…')
    const ts = playbackInfoMediaSources.find((s) => s.supportsTranscoding)?.id
    const resumeSec = videoRef.current?.currentTime ?? 0
    void doLoad({ newMediaSourceId: ts, overrideAudioIndex: index, overrideSubtitleIndex: selectedSubtitleIndex, resumeSeconds: resumeSec })
  }, [playbackBackend, playMethod, selectedMediaSource, playbackInfoMediaSources, selectedSubtitleIndex, doLoad, showToast, videoRef, setSelectedAudioIndex])

  const handleSubtitleChange = useCallback((index: number | null, mode: 'external' | 'encode') => {
    if (playbackBackend === 'mpv') {
      setSelectedSubtitleIndex(index)
      if (index === null) {
        mpvControlRef.current?.setSubtitleTrack?.(null)
        return
      }
      const subtitles = selectedMediaSource ? filterStreams(selectedMediaSource.mediaStreams, 'Subtitle') : []
      const mpvTrackId = subtitles.findIndex((stream) => stream.index === index) + 1
      if (mpvTrackId > 0) mpvControlRef.current?.setSubtitleTrack?.(mpvTrackId)
      return
    }
    if (index === null) {
      setSelectedSubtitleIndex(null)
      if (playMethod === 'Transcode' && selectedSubtitleIndex !== null) {
        const resumeSec = videoRef.current?.currentTime ?? 0
        void doLoad({ overrideAudioIndex: selectedAudioIndex, overrideSubtitleIndex: null, resumeSeconds: resumeSec })
      }
      return
    }
    if (mode === 'external') {
      const sub = selectedMediaSource?.mediaStreams.find((s) => s.type === 'Subtitle' && s.index === index)
      if (!sub) return
      if (!isTextSubtitle(sub)) {
        showToast('该字幕为位图字幕，不支持外挂模式，将使用烧录')
        handleSubtitleChange(index, 'encode')
        return
      }
      setSelectedSubtitleIndex(index)
      return
    }
    setSelectedSubtitleIndex(index)
    const resumeSec = videoRef.current?.currentTime ?? 0
    void doLoad({ overrideAudioIndex: selectedAudioIndex, overrideSubtitleIndex: index, subtitleMode: 'encode', resumeSeconds: resumeSec })
  }, [playbackBackend, playMethod, selectedSubtitleIndex, selectedMediaSource, doLoad, selectedAudioIndex, showToast, videoRef, setSelectedSubtitleIndex])

  const handlePlaybackFailure = useTranscodeFallback({
    itemId, playMode: readSettings.playMode, playMethod,
    selectedMediaSource, selectedAudioIndex, selectedSubtitleIndex,
    videoRef, showToast, doLoad,
  })

  useVideoSource({
    videoRef, hlsRef, liveStreamIdRef,
    currentUrl: playbackBackend === 'html' ? currentUrl : undefined,
    playMethod, liveStreamId,
    resolvedStartTicks, playbackRate, selectedMediaSource, itemId,
    selectedSubtitleIndex, onEnded, onPlaybackFailure: handlePlaybackFailure,
    setError, setLoadState,
  })

  const mpvControl = useEmbeddedMpv({
    enabled: playbackBackend === 'mpv' && loadState === 'ready',
    containerRef,
    itemId,
    url: currentUrl,
    title: itemInfo?.name ?? itemId,
    startSeconds: ticksToSeconds(resolvedStartTicks),
    initialDurationSeconds: ticksToSeconds(selectedMediaSource?.runTimeTicks ?? 0),
    playbackRate,
    controlsVisible,
    onEnded,
    onError: (message) => {
      setError({ message, fatal: true })
      setLoadState('error')
    },
  })
  mpvControlRef.current = mpvControl

  const stats = usePlaybackStats({ videoRef, hlsRef, mpvControl, playbackBackend, mediaSourceBitrate: selectedMediaSource?.bitrate, mediaSourceLabel: selectedMediaSource?.name })

  useEffect(() => {
    if (containerRef.current) applySubtitleFontScale(containerRef.current, subtitleFontScale)
  }, [subtitleFontScale])

  useEffect(() => {
    if (videoRef.current) syncTextTrackMode(videoRef.current, selectedSubtitleIndex)
  }, [selectedSubtitleIndex, currentUrl])

  useEffect(() => {
    if (rememberPlaybackRate && playbackRate > 0) setSettings('defaultPlaybackRate', playbackRate)
  }, [playbackRate, rememberPlaybackRate, setSettings])

  usePlaybackReporting({
    itemId,
    mediaSourceId: selectedMediaSource?.id,
    playSessionId,
    audioStreamIndex: selectedAudioIndex,
    subtitleStreamIndex: selectedSubtitleIndex ?? undefined,
    video: playbackBackend === 'html' ? videoRef.current : null,
    playMethod,
    userId,
  })
  useMpvReporting({
    enabled: playbackBackend === 'mpv',
    itemId,
    mediaSourceId: selectedMediaSource?.id,
    playSessionId,
    audioStreamIndex: selectedAudioIndex,
    subtitleStreamIndex: selectedSubtitleIndex ?? undefined,
    control: mpvControl,
    playMethod,
    userId,
  })

  const subtitleStreams = useMemo(() => filterStreams(selectedMediaSource?.mediaStreams ?? [], 'Subtitle'), [selectedMediaSource])
  const audioStreams = useMemo(() => filterStreams(selectedMediaSource?.mediaStreams ?? [], 'Audio'), [selectedMediaSource])

  useMpvOverlayMetadata({
    enabled: playbackBackend === 'mpv' && loadState === 'ready',
    itemId,
    itemInfo,
    mediaSources: playbackInfoMediaSources,
    currentMediaSourceId: selectedMediaSource?.id,
    audioStreams,
    currentAudioIndex: selectedAudioIndex,
    subtitleStreams,
    currentSubtitleIndex: selectedSubtitleIndex,
    playMethod,
    playbackRate,
    hasPrev,
    hasNext,
  })

  const cycleSubtitles = useCallback(() => {
    if (!subtitleStreams.length) return
    const external = subtitleStreams.filter((s) => isTextSubtitle(s))
    if (!external.length) return
    if (selectedSubtitleIndex === null) { handleSubtitleChange(external[0].index, 'external'); return }
    const idx = external.findIndex((s) => s.index === selectedSubtitleIndex)
    if (idx < 0) handleSubtitleChange(external[0].index, 'external')
    else if (idx >= external.length - 1) handleSubtitleChange(null, 'external')
    else handleSubtitleChange(external[idx + 1].index, 'external')
  }, [selectedSubtitleIndex, subtitleStreams, handleSubtitleChange])

  useKeyboardShortcuts({
    video: playbackBackend === 'html' ? videoRef.current : null,
    control: mpvControl,
    container: containerRef.current,
    hasPrev,
    hasNext,
    onPrev: () => prevHandlerRef.current?.(),
    onNext: () => nextHandlerRef.current?.(),
    playbackRate,
    setPlaybackRate,
    cycleSubtitles,
  }, true)
  useMediaSession({
    item: itemInfo,
    video: playbackBackend === 'html' ? videoRef.current : null,
    hasPrev,
    hasNext,
    onPrev: () => prevHandlerRef.current?.(),
    onNext: () => nextHandlerRef.current?.(),
  })

  const retry = () => void doLoad()
  const nextSource = () => {
    if (!playbackInfoMediaSources.length) return retry()
    const curIdx = playbackInfoMediaSources.findIndex((s) => s.id === selectedMediaSource?.id)
    const next = playbackInfoMediaSources[(curIdx + 1) % playbackInfoMediaSources.length]
    handleMediaSourceChange(next.id)
  }

  usePlayerEpisodeBindings({
    containerRef, itemId, setHasPrev, setHasNext, prevHandlerRef, nextHandlerRef,
  })

  const handlePlaybackRateChange = useCallback((r: number) => {
    setPlaybackRate(r)
    const v = videoRef.current
    if (v) v.playbackRate = r
  }, [])
  const handlePrev = useCallback(() => { prevHandlerRef.current?.() }, [])
  const handleNext = useCallback(() => { nextHandlerRef.current?.() }, [])
  const handleBack = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) window.history.back()
  }, [])
  const handleRateChangeInline = useCallback(() => {
    const v = videoRef.current
    if (v && v.playbackRate !== playbackRate) setPlaybackRate(v.playbackRate)
  }, [playbackRate])
  useMpvOverlayActions({
    enabled: playbackBackend === 'mpv',
    onBack: handleBack,
    onPrev: handlePrev,
    onNext: handleNext,
    onMediaSourceChange: handleMediaSourceChange,
  })
  const hasOtherSource = playbackInfoMediaSources.length > 1
  const showLoadingOverlay =
    loadState === 'loading' ||
    (loadState === 'ready' && playbackBackend === 'mpv' && mpvControl?.started !== true)
  return (
    <div ref={containerRef} className={cx('relative bg-black rounded-xl overflow-hidden aspect-video w-full shadow-2xl group ring-1 ring-white/5', className)}>
      <video
        ref={videoRef}
        playsInline
        preload="metadata"
        className={cx('w-full h-full bg-black', playbackBackend === 'mpv' ? 'opacity-0' : '')}
        onRateChange={handleRateChangeInline}
      />
      <Controls
        video={playbackBackend === 'html' ? videoRef.current : null}
        control={mpvControl}
        container={containerRef.current} item={itemInfo ?? undefined}
        mediaSources={playbackInfoMediaSources} currentMediaSourceId={selectedMediaSource?.id} onMediaSourceChange={handleMediaSourceChange}
        audioStreams={audioStreams} currentAudioIndex={selectedAudioIndex} onAudioChange={handleAudioChange}
        subtitleStreams={subtitleStreams} currentSubtitleIndex={selectedSubtitleIndex} onSubtitleChange={handleSubtitleChange}
        playbackRate={playbackRate} onPlaybackRateChange={handlePlaybackRateChange}
        hasPrev={hasPrev} hasNext={hasNext} onPrev={handlePrev} onNext={handleNext}
        show={controlsVisible} playMethod={playMethod}
        onBack={handleBack}
      />
      {children}
      {toast ? <div className="absolute left-1/2 top-12 -translate-x-1/2 px-4 py-2 rounded-md bg-black/80 text-white text-sm shadow-lg z-30 pointer-events-none">{toast}</div> : null}
      {showLoadingOverlay && (
        <OverlayLoading
          item={itemInfo ?? loadingItem}
          networkBytesPerSecond={mpvControl?.networkBytesPerSecond}
        />
      )}
      {loadState === 'error' && error ? (
        <OverlayError
          message={error.message}
          hasOther={hasOtherSource}
          onRetry={retry}
          onNext={nextSource}
        />
      ) : null}
      <StatsOverlay stats={stats} />
    </div>
  )
}

export type { PlayMethod, MediaStream, BaseItemDto }
