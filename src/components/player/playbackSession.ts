import type {
  BaseItemDto,
  DeviceProfile,
  MediaSourceInfo,
  PlaybackInfoResponse,
  PlayMethod,
} from '@/api/types'
import {
  buildMpvDeviceProfile,
  getPlaybackInfo,
  resolveEmbeddedPlaybackUrl,
  resolveMediaPlayback,
  UnplayableSourceError,
} from '@/api/playback'
import { getItem } from '@/api/library'
import type {
  BurnInSubtitlePolicy,
  PlayMode,
  SourceSelectionStrategy,
  SubtitleAutoSelectPolicy,
} from '@/store/settings'
import { secondsToTicks } from '@/utils/time'
import {
  filterStreams,
  pickDefaultAudio,
  pickDefaultSource,
  pickDefaultSubtitle,
  resolveDelivery,
} from './parts/selectors'

export type PlaybackBackend = 'html' | 'mpv'

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

export type PlayerItemInfo = Pick<
  BaseItemDto,
  | 'id'
  | 'name'
  | 'type'
  | 'indexNumber'
  | 'parentIndexNumber'
  | 'seriesName'
  | 'seasonName'
  | 'imageTags'
  | 'backdropImageTags'
  | 'parentBackdropImageTags'
  | 'parentBackdropItemId'
>

export interface PlayerPlaybackPorts {
  getItem: (userId: string, itemId: string) => Promise<BaseItemDto>
  getPlaybackInfo: typeof getPlaybackInfo
  buildDeviceProfile: () => DeviceProfile
}

export interface LoadPlayerPlaybackSessionParams {
  itemId: string
  userId: string
  startPositionTicks?: number
  defaultMediaSourceId?: string
  defaultAudioIndex?: number
  defaultSubtitleIndex?: number | null
  readSettings: PlayerReadSettings
  opts?: DoLoadOpts
  ports?: PlayerPlaybackPorts
}

export interface PlayerPlaybackSession {
  itemInfo: PlayerItemInfo
  playbackInfoMediaSources: MediaSourceInfo[]
  selectedMediaSource: MediaSourceInfo
  selectedAudioIndex?: number
  selectedSubtitleIndex: number | null
  playMethod: PlayMethod
  currentUrl: string
  liveStreamId?: string
  playSessionId?: string
  playbackBackend: PlaybackBackend
  resolvedStartTicks: number
}

const defaultPorts: PlayerPlaybackPorts = {
  getItem,
  getPlaybackInfo,
  buildDeviceProfile: buildMpvDeviceProfile,
}

export async function loadPlayerPlaybackSession(
  params: LoadPlayerPlaybackSessionParams,
): Promise<PlayerPlaybackSession> {
  const opts = params.opts ?? {}
  const ports = params.ports ?? defaultPorts
  const settings = params.readSettings
  const start = await resolveStartTicks(params, ports)
  const effectivePlayMode = opts.forceTranscode ? 'transcode' : settings.playMode
  const info = await ports.getPlaybackInfo(
    params.userId,
    params.itemId,
    opts.newMediaSourceId ?? params.defaultMediaSourceId,
    buildPlaybackInfoRequest(params, ports, start.ticks, effectivePlayMode),
  )
  assertPlaybackInfo(info)

  const source = pickDefaultSource(info.mediaSources, {
    preferId: opts.newMediaSourceId ?? params.defaultMediaSourceId,
    playMode: effectivePlayMode,
    strategy: settings.sourceStrategy,
  })
  if (!source) throw new Error('无法挑选默认媒体源')

  const streams = pickStreams(
    source,
    opts,
    params.defaultAudioIndex,
    params.defaultSubtitleIndex,
    settings,
  )
  try {
    const resolved = resolveMediaPlayback({
      itemId: params.itemId,
      mediaSource: source,
      userId: params.userId,
      playSessionId: info.playSessionId,
      audioStreamIndex: streams.audio,
      subtitleStreamIndex: streams.delivery === 'encode' && typeof streams.subtitle === 'number'
        ? streams.subtitle
        : undefined,
      startTimeTicks: start.ticks,
      maxBitrate: settings.maxBitrateBps,
      preferredMethod: getPreferredMethod(effectivePlayMode),
    })
    return buildSessionResult(info, source, start.item, streams, {
      backend: 'html',
      url: resolved.url,
      method: resolved.method,
      liveStreamId: resolved.liveStreamId,
      startTicks: start.ticks,
    })
  } catch (error) {
    if (!(error instanceof UnplayableSourceError)) throw error
    return buildSessionResult(info, source, start.item, streams, {
      backend: 'mpv',
      url: resolveEmbeddedPlaybackUrl(params.itemId, source),
      method: 'DirectPlay',
      liveStreamId: undefined,
      startTicks: start.ticks,
    })
  }
}

function buildPlaybackInfoRequest(
  params: LoadPlayerPlaybackSessionParams,
  ports: PlayerPlaybackPorts,
  startTicks: number,
  effectivePlayMode: PlayMode,
): Parameters<typeof getPlaybackInfo>[3] {
  const opts = params.opts ?? {}
  const subtitleStreamIndex = opts.subtitleMode === 'encode' &&
    typeof opts.overrideSubtitleIndex === 'number'
    ? opts.overrideSubtitleIndex
    : undefined
  return {
    deviceProfile: ports.buildDeviceProfile(),
    startTimeTicks: startTicks,
    audioStreamIndex: opts.overrideAudioIndex ?? params.defaultAudioIndex,
    subtitleStreamIndex,
    maxStreamingBitrate: params.readSettings.maxBitrateBps,
    maxAudioChannels: params.readSettings.maxAudioChannels,
    enableDirectPlay: effectivePlayMode !== 'transcode',
    enableDirectStream: effectivePlayMode === 'auto' || effectivePlayMode === 'direct-stream',
    enableTranscoding: effectivePlayMode === 'auto' || effectivePlayMode === 'transcode',
    allowVideoStreamCopy: effectivePlayMode !== 'transcode',
    allowAudioStreamCopy: effectivePlayMode !== 'transcode',
  }
}

async function resolveStartTicks(
  params: LoadPlayerPlaybackSessionParams,
  ports: PlayerPlaybackPorts,
): Promise<{ item: BaseItemDto; ticks: number }> {
  const opts = params.opts ?? {}
  let startTicks = opts.resumeSeconds !== undefined
    ? secondsToTicks(opts.resumeSeconds)
    : params.startPositionTicks ?? 0
  const item = await ports.getItem(params.userId, params.itemId)
  if (startTicks === 0) {
    startTicks = item.userData?.playbackPositionTicks ?? 0
  }
  if (startTicks > 0 && params.readSettings.resumeRewindSeconds > 0) {
    return {
      item,
      ticks: Math.max(0, startTicks - secondsToTicks(params.readSettings.resumeRewindSeconds)),
    }
  }
  return { item, ticks: startTicks }
}

function assertPlaybackInfo(info: PlaybackInfoResponse): void {
  if (info.errorCode) throw new Error(`PlaybackInfo 返回错误：${info.errorCode}`)
  if (!info.mediaSources.length) throw new Error('服务器未返回任何可用媒体源')
}

function buildSessionResult(
  info: PlaybackInfoResponse,
  source: MediaSourceInfo,
  item: BaseItemDto,
  streams: { audio?: number; subtitle: number | null },
  playback: {
    backend: PlaybackBackend
    url: string
    method: PlayMethod
    liveStreamId?: string
    startTicks: number
  },
): PlayerPlaybackSession {
  return {
    itemInfo: toPlayerItemInfo(item),
    playbackInfoMediaSources: info.mediaSources,
    selectedMediaSource: source,
    selectedAudioIndex: streams.audio,
    selectedSubtitleIndex: streams.subtitle,
    playMethod: playback.method,
    currentUrl: playback.url,
    liveStreamId: playback.liveStreamId,
    playSessionId: info.playSessionId,
    playbackBackend: playback.backend,
    resolvedStartTicks: playback.startTicks,
  }
}

function toPlayerItemInfo(item: BaseItemDto): PlayerItemInfo {
  return {
    id: item.id,
    name: item.name,
    type: item.type,
    indexNumber: item.indexNumber,
    parentIndexNumber: item.parentIndexNumber,
    seriesName: item.seriesName,
    seasonName: item.seasonName,
    imageTags: item.imageTags,
    backdropImageTags: item.backdropImageTags,
    parentBackdropImageTags: item.parentBackdropImageTags,
    parentBackdropItemId: item.parentBackdropItemId,
  }
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
