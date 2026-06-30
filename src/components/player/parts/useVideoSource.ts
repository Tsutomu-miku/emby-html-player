import { useEffect, useRef, type RefObject } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type Hls from 'hls.js'
import type { MediaSourceInfo, PlayMethod } from '@/api/types'
import { closeLiveStream } from '@/api/playback'
import { ticksToSeconds } from '@/utils/time'
import { attachSourceToVideo } from './hls'
import { mountExternalSubtitles, unmountAllSubtitles } from './subtitles'

type LoadState = 'idle' | 'loading' | 'ready' | 'error'
interface PlayerError { message: string; fatal?: boolean }

interface UseVideoSourceParams {
  videoRef: RefObject<HTMLVideoElement | null>
  hlsRef: RefObject<Hls | null>
  liveStreamIdRef: RefObject<string | undefined>
  currentUrl?: string
  playMethod?: PlayMethod
  liveStreamId?: string
  resolvedStartTicks: number
  playbackRate: number
  selectedMediaSource?: MediaSourceInfo
  itemId: string
  selectedSubtitleIndex: number | null
  onEnded?: () => void
  onPlaybackFailure: (message: string) => boolean
  setError: Dispatch<SetStateAction<PlayerError | null>>
  setLoadState: Dispatch<SetStateAction<LoadState>>
}

export function useVideoSource(params: UseVideoSourceParams): void {
  const {
    videoRef,
    hlsRef,
    liveStreamIdRef,
    currentUrl,
    playMethod,
    liveStreamId,
    resolvedStartTicks,
    playbackRate,
    selectedMediaSource,
    itemId,
    selectedSubtitleIndex,
    onEnded,
    onPlaybackFailure,
    setError,
    setLoadState,
  } = params

  const latestCallbacksRef = useRef({
    onEnded,
    onPlaybackFailure,
    playbackRate,
    selectedMediaSource,
    selectedSubtitleIndex,
  })
  latestCallbacksRef.current = {
    onEnded,
    onPlaybackFailure,
    playbackRate,
    selectedMediaSource,
    selectedSubtitleIndex,
  }

  useEffect(() => {
    if (!currentUrl) return
    const video = videoRef.current
    if (!video) return

    const cleanupHls = () => {
      hlsRef.current?.destroy()
      hlsRef.current = null
    }
    const resetVideo = () => {
      video.pause()
      video.removeAttribute('src')
      video.load()
    }
    const closeCurrentLiveStream = () => {
      const curLive = liveStreamIdRef.current
      if (!curLive) return
      liveStreamIdRef.current = undefined
      void closeLiveStream(curLive).catch((err: unknown) => {
        console.warn('[Player] close live stream failed', err)
      })
    }
    const fail = (msg: string) => {
      if (latestCallbacksRef.current.onPlaybackFailure(msg)) return
      console.error('[Player] fatal', { msg, currentUrl, playMethod })
      setError({ message: msg, fatal: true })
      setLoadState('error')
    }

    closeCurrentLiveStream()
    cleanupHls()
    resetVideo()
    unmountAllSubtitles(video)
    if (liveStreamId) liveStreamIdRef.current = liveStreamId

    hlsRef.current = attachSourceToVideo(video, currentUrl, playMethod, fail)

    let cancelled = false
    const onLoadedMeta = () => {
      if (cancelled) return
      const startSec = ticksToSeconds(resolvedStartTicks)
      if (startSec > 1 && video.duration > startSec) video.currentTime = startSec
      video.playbackRate = latestCallbacksRef.current.playbackRate
      if (latestCallbacksRef.current.selectedMediaSource) {
        mountExternalSubtitles(
          video,
          latestCallbacksRef.current.selectedMediaSource,
          itemId,
          latestCallbacksRef.current.selectedSubtitleIndex,
        )
      }
      void video.play().catch((err: unknown) => {
        console.warn('[Player] autoplay blocked or failed', err)
      })
    }
    const onVideoError = () => {
      const err = video.error
      const msg = err
        ? `视频播放错误 (code=${err.code})：${err.message || '未知错误'}`
        : '视频播放错误'
      console.error('[Player] video error', {
        code: err?.code,
        message: err?.message,
        currentUrl: currentUrl.slice(0, 200),
        playMethod,
        readyState: video.readyState,
        networkState: video.networkState,
      })
      fail(msg)
    }
    const onEndedH = () => latestCallbacksRef.current.onEnded?.()
    video.addEventListener('loadedmetadata', onLoadedMeta, { once: true })
    video.addEventListener('error', onVideoError)
    video.addEventListener('ended', onEndedH)

    return () => {
      cancelled = true
      video.removeEventListener('loadedmetadata', onLoadedMeta)
      video.removeEventListener('error', onVideoError)
      video.removeEventListener('ended', onEndedH)
      cleanupHls()
      resetVideo()
      closeCurrentLiveStream()
    }
  }, [
    currentUrl,
    hlsRef,
    itemId,
    liveStreamId,
    liveStreamIdRef,
    playMethod,
    resolvedStartTicks,
    setError,
    setLoadState,
    videoRef,
  ])
}
