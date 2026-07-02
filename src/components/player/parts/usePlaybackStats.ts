import { useEffect, useRef, useState, type RefObject } from 'react'
import type Hls from 'hls.js'
import { Events as HlsEvents } from 'hls.js'
import type { PlayerControl } from '../backends/control'

export interface PlaybackStats {
  /** html / mpv / native-hls / safari-hls */
  engine: string
  currentBitrateKbps: number
  /** Sustained downstream throughput (B/s). 0 if unknown. */
  networkBytesPerSecond: number
  /** Seconds of media already buffered ahead of the playhead. */
  bufferedAheadSeconds: number
  /** Video resolution as reported by decoder, e.g. "1920×1080". */
  resolution: string
  /** Current video frame rate (float, e.g. 23.976). 0 if unknown. */
  fps: number
  /** Video codec short name, e.g. "h264", "hevc", "av1". */
  videoCodec: string
  /** Audio codec short name, e.g. "aac", "ac3". */
  audioCodec: string
  /** Whether hardware decoding is active. */
  hwdecActive: boolean | null
  /** Frames dropped by the decoder since playback started. */
  droppedFrames: number
  /** Total number of times playback stalled waiting for data. */
  stallCount: number
  /** Cumulative seconds spent stalled (waiting for data). */
  stallSecondsTotal: number
  /** Currently selected media source / level label. */
  sourceLabel: string
  /** True if the screen is black/blank while we're trying to play — triggers auto-stats. */
  isBlackScreen: boolean
}

const EMPTY: PlaybackStats = {
  engine: 'idle',
  currentBitrateKbps: 0,
  networkBytesPerSecond: 0,
  bufferedAheadSeconds: 0,
  resolution: '',
  fps: 0,
  videoCodec: '',
  audioCodec: '',
  hwdecActive: null,
  droppedFrames: 0,
  stallCount: 0,
  stallSecondsTotal: 0,
  sourceLabel: '',
  isBlackScreen: false,
}

export interface UsePlaybackStatsParams {
  videoRef: RefObject<HTMLVideoElement | null>
  hlsRef: RefObject<Hls | null>
  mpvControl: PlayerControl | undefined
  /** 'html' | 'mpv' */
  playbackBackend: 'html' | 'mpv'
  /** Current URL (for native-HLS detection) */
  currentUrl?: string
  /** MediaSource bitrate if we have it from playlist */
  mediaSourceBitrate?: number
  /** Selected media source label (for display) */
  mediaSourceLabel?: string
}

/**
 * Polls playback statistics from the active backend (hls.js, native HTML video,
 * or embedded mpv) and returns a periodically-refreshed PlaybackStats record.
 */
export function usePlaybackStats(params: UsePlaybackStatsParams): PlaybackStats {
  const { videoRef, hlsRef, mpvControl, playbackBackend, mediaSourceBitrate, mediaSourceLabel } = params
  const [stats, setStats] = useState<PlaybackStats>(EMPTY)

  const stallRef = useRef<{ count: number; totalSec: number; waitingSince: number | null }>({ count: 0, totalSec: 0, waitingSince: 0 })

  // Track stall events on <video> (HTML backend).
  useEffect(() => {
    const v = videoRef.current
    if (playbackBackend !== 'html' || !v) return
    const onWaiting = () => {
      if (stallRef.current.waitingSince === null) stallRef.current.waitingSince = performance.now()
    }
    const onPlaying = () => {
      const s = stallRef.current
      if (s.waitingSince !== null) {
        s.count += 1
        s.totalSec += (performance.now() - s.waitingSince) / 1000
        s.waitingSince = null
      }
    }
    v.addEventListener('waiting', onWaiting)
    v.addEventListener('playing', onPlaying)
    v.addEventListener('stalled', onWaiting)
    return () => {
      v.removeEventListener('waiting', onWaiting)
      v.removeEventListener('playing', onPlaying)
      v.removeEventListener('stalled', onWaiting)
    }
  }, [playbackBackend, videoRef])

  // Attach hls.js level/bandwidth listeners if available.
  useEffect(() => {
    const hls = hlsRef.current
    if (playbackBackend !== 'html' || !hls) return
    let levelBitrate = 0
    const onLevelSwitched = (_e: unknown, data: { level: number }) => {
      const lv = hls.levels?.[data.level]
      levelBitrate = lv?.bitrate ? Math.round(lv.bitrate / 1000) : 0
    }
    hls.on?.(HlsEvents.LEVEL_SWITCHED, onLevelSwitched)
    return () => {
      hls.off?.(HlsEvents.LEVEL_SWITCHED, onLevelSwitched)
      void levelBitrate
    }
  }, [playbackBackend, hlsRef])

  // Periodically sample stats.
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const tick = () => {
      const now = performance.now()
      const deltaMs = now - last
      if (deltaMs >= 500) {
        last = now
        setStats(sampleStats({
          video: videoRef.current,
          hls: hlsRef.current,
          mpv: mpvControl,
          playbackBackend,
          mediaSourceBitrate,
          mediaSourceLabel,
          stall: stallRef.current,
          prev: EMPTY,
        }))
      }
      raf = window.requestAnimationFrame(tick)
    }
    raf = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(raf)
    // hls/mpv/video are refs; re-run only when backend/source metadata changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playbackBackend, mediaSourceBitrate, mediaSourceLabel])

  return stats
}

function sampleStats(args: {
  video: HTMLVideoElement | null
  hls: Hls | null
  mpv: PlayerControl | undefined
  playbackBackend: 'html' | 'mpv'
  mediaSourceBitrate?: number
  mediaSourceLabel?: string
  stall: { count: number; totalSec: number; waitingSince: number | null }
  prev: PlaybackStats
}): PlaybackStats {
  const { video, hls, mpv, playbackBackend, mediaSourceBitrate, mediaSourceLabel, stall } = args

  // mpv backend, but control object not yet initialized — treat as black screen
  // and fall back to whatever metadata we have (source label / bitrate).
  if (playbackBackend === 'mpv' && !mpv) {
    return {
      engine: 'mpv (初始化中)',
      currentBitrateKbps: mediaSourceBitrate ? Math.round(mediaSourceBitrate / 1000) : 0,
      networkBytesPerSecond: 0,
      bufferedAheadSeconds: 0,
      resolution: '',
      fps: 0,
      videoCodec: '',
      audioCodec: '',
      hwdecActive: null,
      droppedFrames: 0,
      stallCount: stall.count,
      stallSecondsTotal: stall.totalSec,
      sourceLabel: mediaSourceLabel ?? '',
      isBlackScreen: true,
    }
  }

  if (playbackBackend === 'mpv' && mpv) {
    // mpv exposes network speed + duration on the control; for the rest we
    // query codec/resolution via a best-effort ephemeral property read.
    const bw = mpv.networkBytesPerSecond ?? 0
    const bufferedAhead = Math.max(0, (mpv.bufferedEnd ?? 0) - (mpv.currentTime ?? 0))
    // Black-screen / buffering windows for mpv:
    //   (a) mpv.started !== true — initial decode hasn't produced a frame.
    //   (b) started && buffered-ahead is starved (< 0.5 s) while we are still
    //       pulling bytes — classic stall/mid-stream re-buffer.
    const reBuffering = mpv.started === true && bufferedAhead < 0.5 && bw > 0
    const isBlackScreen = mpv.started !== true || reBuffering
    return {
      engine: 'mpv (libmpv)',
      currentBitrateKbps: mediaSourceBitrate ? Math.round(mediaSourceBitrate / 1000) : 0,
      networkBytesPerSecond: bw,
      bufferedAheadSeconds: bufferedAhead,
      resolution: readMpvVideoResolution(),
      fps: 0,
      videoCodec: (window as unknown as { __mpvLastCodec?: string }).__mpvLastCodec ?? '',
      audioCodec: '',
      hwdecActive: null,
      droppedFrames: 0,
      stallCount: stall.count,
      stallSecondsTotal: stall.totalSec,
      sourceLabel: mediaSourceLabel ?? '',
      isBlackScreen,
    }
  }

  // html backend (hls.js or native)
  let engine = 'html/native'
  if (hls) engine = 'hls.js'
  else if (video && video.currentSrc && /\.m3u8/i.test(video.currentSrc)) engine = 'safari/native-hls'

  let currentBitrateKbps = mediaSourceBitrate ? Math.round(mediaSourceBitrate / 1000) : 0
  let bandwidthBps = 0
  if (hls && hls.bandwidthEstimate > 0) bandwidthBps = Math.round(hls.bandwidthEstimate / 8)
  if (hls?.levels) {
    const cur = typeof hls.currentLevel === 'number' ? hls.levels[hls.currentLevel] : null
    if (cur?.bitrate) currentBitrateKbps = Math.round(cur.bitrate / 1000)
  }
  // If backend is Safari/HLS we lack a direct bandwidth number; fall back to
  // any download rate from <video> progress events (best-effort via buffered
  // slope over time is noisy but better than nothing).
  if (!bandwidthBps && video && video.buffered.length > 0) {
    // No reliable estimate; leave 0 so the UI shows "N/A".
    void 0
  }

  let bufferedAhead = 0
  if (video && Number.isFinite(video.currentTime) && video.buffered.length > 0) {
    const end = video.buffered.end(video.buffered.length - 1)
    bufferedAhead = Math.max(0, end - video.currentTime)
  }

  let resolution = ''
  let videoCodec = ''
  const fps = 0
  let droppedFrames = 0
  const hwdecActive: boolean | null = null

  if (video) {
    const vw = (video as HTMLVideoElement & { videoWidth?: number }).videoWidth
    const vh = (video as HTMLVideoElement & { videoHeight?: number }).videoHeight
    if (vw && vh) resolution = `${vw}×${vh}`
    const vq = (video as HTMLVideoElement & {
      getVideoPlaybackQuality?: () => { droppedVideoFrames?: number; totalVideoFrames?: number }
    }).getVideoPlaybackQuality?.()
    if (vq?.droppedVideoFrames !== undefined) droppedFrames = vq.droppedVideoFrames

    // Chrome-only: VideoDecoder data via MediaCapabilities extensions
    try {
      // videoTracks codecs — not always populated, best-effort.
      const tracks = (video as HTMLVideoElement & {
        videoTracks?: ArrayLike<{ selected?: boolean; language?: string }>
      }).videoTracks
      void tracks
    } catch { /* ignore */ }

    void hwdecActive
  }

  // Read WebCodecs/VideoFrame metadata if available (best-effort).
  try {
    if (video && typeof (window as unknown as { __lastCodec?: string }).__lastCodec === 'string') {
      videoCodec = (window as unknown as { __lastCodec: string }).__lastCodec
    }
  } catch { /* ignore */ }

  // Detect "黑屏": media session started but no decoded frame is available to render.
  const HAVE_CURRENT_DATA = 2
  let isBlackScreen = false
  if (video) {
    const vw = (video as HTMLVideoElement & { videoWidth?: number }).videoWidth ?? 0
    const sessionActive = video.currentSrc && (video.duration > 0 || video.currentTime > 0 || video.networkState >= 1)
    const noFrame =
      !sessionActive ||
      (video as HTMLVideoElement & { readyState: number }).readyState < HAVE_CURRENT_DATA ||
      vw === 0
    const userWaiting = !(video.paused && video.currentTime === 0)
    isBlackScreen = !!sessionActive && noFrame && userWaiting
  }

  return {
    engine,
    currentBitrateKbps,
    networkBytesPerSecond: bandwidthBps,
    bufferedAheadSeconds: bufferedAhead,
    resolution,
    fps,
    videoCodec,
    audioCodec: '',
    hwdecActive: null,
    droppedFrames,
    stallCount: stall.count,
    stallSecondsTotal: stall.totalSec,
    sourceLabel: mediaSourceLabel ?? '',
    isBlackScreen,
  }
}

/* -------------------------------------------------------------------------- */
/*  mpv helpers — best effort; properties are reported via the addon IPC.     */
/* -------------------------------------------------------------------------- */

function readMpvVideoResolution(): string {
  const w = (window as unknown as { __mpvWidth?: number }).__mpvWidth
  const h = (window as unknown as { __mpvHeight?: number }).__mpvHeight
  return w && h ? `${w}×${h}` : ''
}
