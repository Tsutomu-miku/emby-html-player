import { useCallback, useState } from 'react'
import type { BaseItemDto, MediaSourceInfo, PlayMethod } from '@/api/types'
import { buildMpvDeviceProfile, getPlaybackInfo, resolveEmbeddedPlaybackUrl, resolveMediaPlayback, UnplayableSourceError } from '@/api/playback'
import { getItem } from '@/api/library'
import type {
  BurnInSubtitlePolicy,
  PlayMode,
  SourceSelectionStrategy,
  SubtitleAutoSelectPolicy,
} from '@/store/settings'
import { secondsToTicks } from '@/utils/time'
import { filterStreams, pickDefaultAudio, pickDefaultSource, pickDefaultSubtitle, resolveDelivery } from './selectors'
export type LoadState = 'idle' | 'loading' | 'ready' | 'error'
export type PlaybackBackend = 'html' | 'mpv'
export interface PlayerError { message: string; fatal?: boolean }
export interface DoLoadOpts {
  newMediaSourceId?: string
  overrideAudioIndex?: number
  overrideSubtitleIndex?: number | null
  subtitleMode?: 'external' | 'encode'
  resumeSeconds?: number
  forceTranscode?: boolean
}
export interface PlayerReadSettings {
  playMode: PlayMode
  maxBitrateBps: number
  maxAudioChannels: number
  sourceStrategy: SourceSelectionStrategy
  preferredAudioLangs: string[]
  preferredSubLangs: string[]
  subtitleAutoSelect: SubtitleAutoSelectPolicy
  burnInPolicy: BurnInSubtitlePolicy
  subtitleForcedOnly: boolean
  resumeRewindSeconds: number
}
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

type ItemInfo = Pick<
  BaseItemDto,
  'id' | 'name' | 'type' | 'indexNumber' | 'parentIndexNumber' | 'seriesName' | 'seasonName' | 'imageTags'
>

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
  const [itemInfo, setItemInfo] = useState<ItemInfo | null>(null)

  const doLoad = useCallback(async (opts: DoLoadOpts = {}) => {
    if (!userId) throw new Error('未登录，无法加载播放信息')
    setLoadState('loading')
    setError(null)
    setCurrentUrl(undefined)
    resetIntroSkip()

    const s = readSettings
    let mpvCandidate: MediaSourceInfo | undefined
    try {
      const startTicks = await resolveStartTicks({
        resumeSeconds: opts.resumeSeconds,
        startPositionTicks,
        resumeRewindSeconds: s.resumeRewindSeconds,
        userId,
        itemId,
        setItemInfo,
      })
      const effectivePlayMode = opts.forceTranscode ? 'transcode' : s.playMode
      const subtitleStreamIndex = opts.subtitleMode === 'encode' &&
        typeof opts.overrideSubtitleIndex === 'number'
        ? opts.overrideSubtitleIndex
        : undefined
      const info = await getPlaybackInfo(userId, itemId, opts.newMediaSourceId ?? defaultMediaSourceId, {
        deviceProfile: buildMpvDeviceProfile(),
        startTimeTicks: startTicks,
        audioStreamIndex: opts.overrideAudioIndex ?? defaultAudioIndex,
        subtitleStreamIndex,
        maxStreamingBitrate: s.maxBitrateBps,
        maxAudioChannels: s.maxAudioChannels,
        enableDirectPlay: effectivePlayMode !== 'transcode',
        enableDirectStream: effectivePlayMode === 'auto' || effectivePlayMode === 'direct-stream',
        enableTranscoding: effectivePlayMode === 'auto' || effectivePlayMode === 'transcode',
        allowVideoStreamCopy: effectivePlayMode !== 'transcode',
        allowAudioStreamCopy: effectivePlayMode !== 'transcode',
      })
      if (info.errorCode) throw new Error(`PlaybackInfo 返回错误：${info.errorCode}`)
      if (!info.mediaSources?.length) throw new Error('服务器未返回任何可用媒体源')
      setPlaybackInfoMediaSources(info.mediaSources)
      setPlaySessionId(info.playSessionId)

      const src = pickDefaultSource(info.mediaSources, {
        preferId: opts.newMediaSourceId ?? defaultMediaSourceId,
        playMode: effectivePlayMode,
        strategy: s.sourceStrategy,
      })
      if (!src) throw new Error('无法挑选默认媒体源')
      setSelectedMediaSource(src)
      mpvCandidate = src

      const picked = pickStreams(src, opts, defaultAudioIndex, defaultSubtitleIndex, s)
      setSelectedAudioIndex(picked.audio)
      setSelectedSubtitleIndex(picked.subtitle)
      setResolvedStartTicks(startTicks)

      const resolved = resolveMediaPlayback({
        itemId,
        mediaSource: src,
        userId,
        playSessionId: info.playSessionId,
        audioStreamIndex: picked.audio,
        subtitleStreamIndex: picked.delivery === 'encode' && typeof picked.subtitle === 'number'
          ? picked.subtitle
          : undefined,
        startTimeTicks: startTicks,
        maxBitrate: s.maxBitrateBps,
        preferredMethod: getPreferredMethod(effectivePlayMode),
      })
      setCurrentUrl(resolved.url)
      setPlayMethod(resolved.method)
      setPlaybackBackend('html')
      setLiveStreamId(resolved.liveStreamId)
      setLoadState('ready')
    } catch (err) {
      if (err instanceof UnplayableSourceError && mpvCandidate) {
        const mpvUrl = resolveEmbeddedPlaybackUrl(itemId, mpvCandidate)
        setCurrentUrl(mpvUrl)
        setPlayMethod('DirectPlay')
        setPlaybackBackend('mpv')
        setLiveStreamId(undefined)
        setLoadState('ready')
        return
      }
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

async function resolveStartTicks(params: {
  resumeSeconds?: number
  startPositionTicks?: number
  resumeRewindSeconds: number
  userId: string
  itemId: string
  setItemInfo: (item: ItemInfo) => void
}): Promise<number> {
  let startTicks = params.resumeSeconds !== undefined
    ? secondsToTicks(params.resumeSeconds)
    : params.startPositionTicks ?? 0
  if (startTicks === 0) {
    try {
      const item = await getItem(params.userId, params.itemId)
      startTicks = item.userData?.playbackPositionTicks ?? 0
      params.setItemInfo({
        id: item.id,
        name: item.name,
        type: item.type,
        indexNumber: item.indexNumber,
        parentIndexNumber: item.parentIndexNumber,
        seriesName: item.seriesName,
        seasonName: item.seasonName,
        imageTags: item.imageTags,
      })
    } catch (err) {
      console.warn('[Player] get item resume position failed', err)
    }
  }
  if (startTicks > 0 && params.resumeRewindSeconds > 0) {
    return Math.max(0, startTicks - secondsToTicks(params.resumeRewindSeconds))
  }
  return startTicks
}

function pickStreams(
  source: MediaSourceInfo,
  opts: DoLoadOpts,
  defaultAudioIndex: number | undefined,
  defaultSubtitleIndex: number | null | undefined,
  settings: PlayerReadSettings,
): { audio?: number; subtitle: number | null; delivery: 'external' | 'encode' } {
  const audioStreams = filterStreams(source.mediaStreams, 'Audio')
  const subtitleStreams = filterStreams(source.mediaStreams, 'Subtitle')
  const audio = pickDefaultAudio(audioStreams, {
    preferredIndex: opts.overrideAudioIndex ?? defaultAudioIndex,
    mediaSourceDefaultIndex: source.defaultAudioStreamIndex ?? null,
    preferredLanguages: settings.preferredAudioLangs,
  })
  const chosenAudio = audioStreams.find((stream) => stream.index === audio)
  if (opts.overrideSubtitleIndex !== undefined) {
    const stream = subtitleStreams.find((item) => item.index === opts.overrideSubtitleIndex)
    return {
      audio,
      subtitle: opts.overrideSubtitleIndex,
      delivery: stream ? resolveDelivery(stream, settings.burnInPolicy) : (opts.subtitleMode ?? 'external'),
    }
  }
  if (typeof defaultSubtitleIndex === 'number') {
    const stream = subtitleStreams.find((item) => item.index === defaultSubtitleIndex)
    return {
      audio,
      subtitle: defaultSubtitleIndex,
      delivery: stream ? resolveDelivery(stream, settings.burnInPolicy) : 'external',
    }
  }
  if (defaultSubtitleIndex === null) return { audio, subtitle: null, delivery: 'external' }
  const picked = pickDefaultSubtitle(subtitleStreams, {
    preferredLanguages: settings.preferredSubLangs,
    autoSelect: settings.subtitleAutoSelect,
    burnInPolicy: settings.burnInPolicy,
    forcedOnly: settings.subtitleForcedOnly,
    audioStream: chosenAudio,
  })
  return { audio, subtitle: picked.index, delivery: picked.delivery }
}

function getPreferredMethod(playMode: PlayMode): PlayMethod | undefined {
  if (playMode === 'transcode') return 'Transcode'
  if (playMode === 'direct-stream' || playMode === 'auto') return 'DirectStream'
  return undefined
}
