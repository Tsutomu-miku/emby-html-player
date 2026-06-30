import { useCallback, useRef, type RefObject } from 'react'
import type { MediaSourceInfo, PlayMethod } from '@/api/types'
import type { PlayMode } from '@/store/settings'

interface DoLoadForFallback {
  (opts: {
    newMediaSourceId?: string
    overrideAudioIndex?: number
    overrideSubtitleIndex?: number | null
    resumeSeconds?: number
    forceTranscode?: boolean
  }): Promise<void>
}

interface UseTranscodeFallbackParams {
  itemId: string
  playMode: PlayMode
  playMethod?: PlayMethod
  selectedMediaSource?: MediaSourceInfo
  selectedAudioIndex?: number
  selectedSubtitleIndex: number | null
  videoRef: RefObject<HTMLVideoElement | null>
  showToast: (message: string) => void
  doLoad: DoLoadForFallback
}

export function useTranscodeFallback(params: UseTranscodeFallbackParams) {
  const fallbackKeyRef = useRef<string | undefined>(undefined)
  const {
    itemId,
    playMode,
    playMethod,
    selectedMediaSource,
    selectedAudioIndex,
    selectedSubtitleIndex,
    videoRef,
    showToast,
    doLoad,
  } = params

  return useCallback((message: string): boolean => {
    const src = selectedMediaSource
    if (playMode !== 'auto' || !src) {
      return false
    }
    const fallbackKey = `${itemId}:${src.id}`
    if (fallbackKeyRef.current === fallbackKey) return false
    fallbackKeyRef.current = fallbackKey
    if (playMethod === 'Transcode' || !src.supportsTranscoding) return false
    const resumeSeconds = videoRef.current?.currentTime ?? 0
    console.warn('[Player] direct playback failed, retrying as transcode', {
      message,
      mediaSourceId: src.id,
      playMethod,
      resumeSeconds,
    })
    showToast('直链播放失败，切换到服务器转码…')
    void doLoad({
      newMediaSourceId: src.id,
      overrideAudioIndex: selectedAudioIndex,
      overrideSubtitleIndex: selectedSubtitleIndex,
      resumeSeconds,
      forceTranscode: true,
    })
    return true
  }, [
    doLoad,
    itemId,
    playMethod,
    playMode,
    selectedAudioIndex,
    selectedMediaSource,
    selectedSubtitleIndex,
    showToast,
    videoRef,
  ])
}
