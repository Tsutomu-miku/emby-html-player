import { useCallback, useState } from 'react'
import type { MediaSourceInfo, PlayMethod } from '@/api/types'
import {
  loadPlayerPlaybackSession,
  type DoLoadOpts,
  type PlayerItemInfo,
  type PlayerReadSettings,
  type PlaybackBackend,
} from '../playbackSession'

export type LoadState = 'idle' | 'loading' | 'ready' | 'error'
export interface PlayerError { message: string; fatal?: boolean }

interface UsePlayerLoaderParams {
  itemId: string
  userId?: string
  startPositionTicks?: number
  defaultMediaSourceId?: string
  defaultAudioIndex?: number
  defaultSubtitleIndex?: number | null
  readSettings: PlayerReadSettings
  resetIntroSkip: () => void
}

export function usePlayerLoader(params: UsePlayerLoaderParams) {
  const {
    itemId,
    userId,
    startPositionTicks,
    defaultMediaSourceId,
    defaultAudioIndex,
    defaultSubtitleIndex,
    readSettings,
    resetIntroSkip,
  } = params
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [error, setError] = useState<PlayerError | null>(null)
  const [playbackInfoMediaSources, setPlaybackInfoMediaSources] = useState<MediaSourceInfo[]>([])
  const [selectedMediaSource, setSelectedMediaSource] = useState<MediaSourceInfo | undefined>()
  const [selectedAudioIndex, setSelectedAudioIndex] = useState<number | undefined>()
  const [selectedSubtitleIndex, setSelectedSubtitleIndex] = useState<number | null>(null)
  const [playMethod, setPlayMethod] = useState<PlayMethod | undefined>()
  const [currentUrl, setCurrentUrl] = useState<string | undefined>()
  const [liveStreamId, setLiveStreamId] = useState<string | undefined>()
  const [playSessionId, setPlaySessionId] = useState<string | undefined>()
  const [playbackBackend, setPlaybackBackend] = useState<PlaybackBackend>('html')
  const [resolvedStartTicks, setResolvedStartTicks] = useState<number>(0)
  const [itemInfo, setItemInfo] = useState<PlayerItemInfo | null>(null)

  const doLoad = useCallback(async (opts: DoLoadOpts = {}) => {
    if (!userId) throw new Error('未登录，无法加载播放信息')
    setLoadState('loading')
    setError(null)
    setCurrentUrl(undefined)
    resetIntroSkip()

    try {
      const session = await loadPlayerPlaybackSession({
        userId,
        itemId,
        startPositionTicks,
        defaultMediaSourceId,
        defaultAudioIndex,
        defaultSubtitleIndex,
        readSettings,
        opts,
      })
      setPlaybackInfoMediaSources(session.playbackInfoMediaSources)
      setPlaySessionId(session.playSessionId)
      setSelectedMediaSource(session.selectedMediaSource)
      setSelectedAudioIndex(session.selectedAudioIndex)
      setSelectedSubtitleIndex(session.selectedSubtitleIndex)
      setResolvedStartTicks(session.resolvedStartTicks)
      setItemInfo(session.itemInfo)
      setCurrentUrl(session.currentUrl)
      setPlayMethod(session.playMethod)
      setPlaybackBackend(session.playbackBackend)
      setLiveStreamId(session.liveStreamId)
      setLoadState('ready')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[Player] load failed', { msg, itemId, playMode: readSettings.playMode })
      setError({ message: msg, fatal: true })
      setLoadState('error')
    }
  }, [
    defaultAudioIndex,
    defaultMediaSourceId,
    defaultSubtitleIndex,
    itemId,
    readSettings,
    resetIntroSkip,
    startPositionTicks,
    userId,
  ])

  return {
    loadState,
    setLoadState,
    error,
    setError,
    playbackInfoMediaSources,
    selectedMediaSource,
    selectedAudioIndex,
    setSelectedAudioIndex,
    selectedSubtitleIndex,
    setSelectedSubtitleIndex,
    playMethod,
    currentUrl,
    liveStreamId,
    playSessionId,
    playbackBackend,
    resolvedStartTicks,
    itemInfo,
    doLoad,
  }
}
