import { request } from './http'
import type {
  MediaSourceInfo,
  PlaybackInfoRequest,
  PlaybackInfoResponse,
  PlaybackProgressEvent,
  MediaStream,
  DeviceProfile,
} from './types'
import { useAuthStore } from '@/store/auth'
import type { PlayMethod } from './types'

/** 浏览器/设备播放能力描述，用于 PlaybackInfo 转码协商。 */
export function buildDeviceProfile(): DeviceProfile {
  // 检测容器/编码支持（简化版）
  const video = document.createElement('video')
  const canPlayH264 = !!video.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"').replace(/^no$/, '')
  const canPlayHevc = !!video.canPlayType('video/mp4; codecs="hvc1.1.6.L93.B0, mp4a.40.2"').replace(/^no$/, '')
  const canPlayVp9 = !!video.canPlayType('video/webm; codecs="vp9"').replace(/^no$/, '')
  const canPlayAv1 = !!video.canPlayType('video/mp4; codecs="av01.0.05M.08"').replace(/^no$/, '')
  const canPlayAac = !!video.canPlayType('audio/mp4; codecs="mp4a.40.2"').replace(/^no$/, '')
  const canPlayMp3 = !!video.canPlayType('audio/mpeg').replace(/^no$/, '')
  const canPlayFlac = !!video.canPlayType('audio/flac').replace(/^no$/, '')
  const canPlayOpus = !!video.canPlayType('audio/opus').replace(/^no$/, '')
  const canNativeHls = !!video.canPlayType('application/vnd.apple.mpegurl').replace(/^no$/, '')

  const directPlayVideoCodecs = ['h264']
  const directPlayContainers = ['mp4', 'm4v', 'mov']
  if (canPlayHevc) directPlayVideoCodecs.push('hevc', 'h265')
  if (canPlayVp9) directPlayVideoCodecs.push('vp9')
  if (canPlayAv1) directPlayVideoCodecs.push('av1')
  if (canNativeHls) {
    directPlayContainers.push('m3u8', 'm4v')
  }

  const directAudioCodecs = []
  if (canPlayAac) directAudioCodecs.push('aac')
  if (canPlayMp3) directAudioCodecs.push('mp3', 'mp2')
  if (canPlayFlac) directAudioCodecs.push('flac')
  if (canPlayOpus) directAudioCodecs.push('opus')
  directAudioCodecs.push('ac3', 'eac3', 'dts') // 浏览器可能直接透传

  const transcodeVideoCodec = 'h264'
  const transcodeAudioCodec = 'aac'

  return {
    Name: 'Emby H5 Player',
    MaxStreamingBitrate: 20_000_000,
    MaxStaticBitrate: 40_000_000,
    MusicStreamingTranscodingBitrate: 384_000,
    DirectPlayProfiles: [
      {
        Container: directPlayContainers.join(','),
        Type: 'Video',
        VideoCodec: directPlayVideoCodecs.join(','),
        AudioCodec: directAudioCodecs.join(','),
      },
      {
        Container: 'mp3',
        Type: 'Audio',
        AudioCodec: 'mp3',
      },
      {
        Container: 'aac',
        Type: 'Audio',
        AudioCodec: 'aac',
      },
      {
        Container: 'flac',
        Type: 'Audio',
        AudioCodec: 'flac',
      },
      {
        Container: 'opus',
        Type: 'Audio',
        AudioCodec: 'opus',
      },
    ],
    TranscodingProfiles: [
      {
        Container: canNativeHls ? 'ts' : 'aac', // ts 用于视频转码，aac 用于音频
        Type: 'Video',
        AudioCodec: transcodeAudioCodec,
        VideoCodec: transcodeVideoCodec,
        Protocol: 'http',
        MaxAudioChannels: '6',
        MinSegments: 2,
        BreakOnNonKeyFrames: true,
      },
      {
        Container: 'aac',
        Type: 'Audio',
        AudioCodec: 'aac',
        Protocol: 'http',
      },
      {
        Container: 'mp3',
        Type: 'Audio',
        AudioCodec: 'mp3',
        Protocol: 'http',
      },
      {
        Container: 'm3u8',
        Type: 'Video',
        AudioCodec: transcodeAudioCodec,
        VideoCodec: transcodeVideoCodec,
        Protocol: 'hls',
        MaxAudioChannels: '6',
        MinSegments: 2,
        EnableSubtitlesInManifest: true,
        BreakOnNonKeyFrames: true,
      },
    ],
    SubtitleProfiles: [
      { Format: 'vtt', Method: 'External', DidlMode: 'SUBTITLE' },
      { Format: 'subrip', Method: 'External' },
      { Format: 'srt', Method: 'External' },
      { Format: 'ass', Method: 'External' },
      { Format: 'ssa', Method: 'External' },
      { Format: 'pgssub', Method: 'Hls' },
      { Format: 'dvdsub', Method: 'Hls' },
      { Format: 'sub', Method: 'External' },
      { Format: 'ttml', Method: 'External' },
    ],
    CodecProfiles: [
      {
        Type: 'Video',
        Codec: 'h264',
        Conditions: [
          { Condition: 'LessThanEqual', Property: 'Width', Value: '3840', IsRequired: false },
          { Condition: 'LessThanEqual', Property: 'Height', Value: '2160', IsRequired: false },
          { Condition: 'LessThanEqual', Property: 'VideoLevel', Value: '52', IsRequired: false },
        ],
      },
      {
        Type: 'VideoAudio',
        Codec: 'aac,mp3,mp2,opus,flac',
        Conditions: [
          { Condition: 'LessThanEqual', Property: 'AudioChannels', Value: '8', IsRequired: false },
        ],
      },
    ],
  } as DeviceProfile
}

/**
 * 获取 PlaybackInfo：Emby 决定返回哪些 media sources，以及转码 URL。
 */
export function getPlaybackInfo(
  userId: string,
  itemId: string,
  mediaSourceId?: string,
  extra: Partial<PlaybackInfoRequest> = {},
): Promise<PlaybackInfoResponse> {
  const body: PlaybackInfoRequest = {
    userId,
    startTimeTicks: 0,
    mediaSourceId,
    audioStreamIndex: extra.audioStreamIndex,
    subtitleStreamIndex: extra.subtitleStreamIndex,
    maxStreamingBitrate: extra.maxStreamingBitrate ?? 20_000_000,
    maxAudioChannels: extra.maxAudioChannels ?? 6,
    enableDirectPlay: extra.enableDirectPlay ?? true,
    enableDirectStream: extra.enableDirectStream ?? true,
    enableTranscoding: extra.enableTranscoding ?? true,
    allowVideoStreamCopy: extra.allowVideoStreamCopy ?? true,
    allowAudioStreamCopy: extra.allowAudioStreamCopy ?? true,
    autoOpenLiveStream: true,
    deviceProfile: extra.deviceProfile ?? buildDeviceProfile(),
    liveStreamId: extra.liveStreamId,
  }
  return request<PlaybackInfoResponse>(`/Items/${itemId}/PlaybackInfo`, {
    method: 'POST',
    params: { StartTimeTicks: body.startTimeTicks ?? 0, UserId: userId },
    body,
  })
}

/** 关闭直播（仅当 PlaybackInfo 返回了 LiveStreamId 时需要） */
export function closeLiveStream(liveStreamId: string) {
  return request(`/LiveStreams/Close`, {
    method: 'POST',
    params: { LiveStreamId: liveStreamId },
  })
}

/**
 * 根据 MediaSourceInfo 决定最终播放 URL 和播放方式（DirectPlay/DirectStream/Transcode）。
 */
export function resolveMediaPlayback(params: {
  itemId: string
  mediaSource: MediaSourceInfo
  userId?: string
  playSessionId?: string
  audioStreamIndex?: number
  subtitleStreamIndex?: number
  maxBitrate?: number
  container?: string
  startTimeTicks?: number
}): { url: string; method: PlayMethod; liveStreamId?: string } {
  const {
    itemId,
    mediaSource,
    playSessionId,
    audioStreamIndex,
    subtitleStreamIndex,
    maxBitrate = 20_000_000,
    startTimeTicks = 0,
  } = params

  const { accessToken, deviceId, server, userId } = {
    ...useAuthStore.getState(),
    userId: params.userId ?? useAuthStore.getState().userId,
  }
  const base = server.replace(/\/+$/, '')

  // 1. DirectPlay
  if (mediaSource.supportsDirectPlay && mediaSource.directStreamUrl) {
    return {
      url: makeAbsolute(base, appendAuth(mediaSource.directStreamUrl, accessToken, deviceId)),
      method: 'DirectPlay',
      liveStreamId: undefined,
    }
  }

  // 2. 转码
  if (mediaSource.supportsTranscoding && mediaSource.transcodingUrl) {
    const url = new URL(
      makeAbsolute(base, appendAuth(mediaSource.transcodingUrl, accessToken, deviceId)),
    )
    if (playSessionId && !url.searchParams.has('PlaySessionId')) {
      url.searchParams.set('PlaySessionId', playSessionId)
    }
    if (startTimeTicks) {
      url.searchParams.set('StartTimeTicks', String(startTimeTicks))
    }
    return { url: url.toString(), method: 'Transcode' }
  }

  // 3. 退回 DirectStream：progressive URL
  const container = mediaSource.container?.split(',')[0] || 'mp4'
  const params_: Record<string, string | number | undefined> = {
    MediaSourceId: mediaSource.id,
    Static: 'true',
    Tag: mediaSource.eTag ?? '',
    api_key: accessToken,
    DeviceId: deviceId,
  }
  if (playSessionId) params_.PlaySessionId = playSessionId
  if (audioStreamIndex !== undefined) params_.AudioStreamIndex = audioStreamIndex
  if (subtitleStreamIndex !== undefined) {
    params_.SubtitleStreamIndex = subtitleStreamIndex
    params_.SubtitleMethod = 'Encode'
  }
  if (maxBitrate) params_.MaxStreamingBitrate = maxBitrate
  if (startTimeTicks) params_.StartTimeTicks = startTimeTicks
  const qs = Object.entries(params_)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&')
  const ext = container && container !== 'mkv' ? `.${container}` : '.ts'
  return {
    url: `${base}/Videos/${itemId}/stream${ext}?${qs}`,
    method: 'DirectStream',
  }
  void userId
}

function appendAuth(url: string, accessToken: string, deviceId: string): string {
  const [prefix, fragment = ''] = url.split('#')
  const [pathPart, query = ''] = prefix.split('?')
  const params = new URLSearchParams(query)
  if (!params.has('api_key') && !params.has('X-Emby-Token')) {
    params.set('api_key', accessToken)
  }
  if (!params.has('DeviceId')) params.set('DeviceId', deviceId)
  const qs = params.toString()
  return `${pathPart}${qs ? `?${qs}` : ''}${fragment ? `#${fragment}` : ''}`
}

function makeAbsolute(base: string, url: string): string {
  if (/^https?:/i.test(url)) return url
  if (url.startsWith('//')) return `https:${url}`
  return `${base}${url.startsWith('/') ? url : `/${url}`}`
}

/** 上报播放开始 */
export function reportPlaybackStart(ev: PlaybackProgressEvent) {
  return request(`/Sessions/Playing`, {
    method: 'POST',
    body: ev,
  })
}

/** 上报播放进度 */
export function reportPlaybackProgress(ev: PlaybackProgressEvent) {
  return request(`/Sessions/Playing/Progress`, {
    method: 'POST',
    body: ev,
  })
}

/** 上报播放停止 */
export function reportPlaybackStop(ev: PlaybackProgressEvent) {
  return request(`/Sessions/Playing/Stopped`, {
    method: 'POST',
    body: ev,
  })
}

/**
 * 字幕流 URL（外挂）—— 浏览器可用 <track kind="subtitles"> 加载。
 * 优先返回 VTT，如果源是 SRT/ASS，也能直接支持现代浏览器的部分实现，否则让 Emby 转码。
 */
export function getSubtitleUrl(params: {
  itemId: string
  mediaSourceId: string
  subtitleStreamIndex: number
  /** 目标格式：vtt 或 srt/ass 等 */
  format?: string
}): string {
  const { server, accessToken, deviceId } = useAuthStore.getState()
  const base = server.replace(/\/+$/, '')
  const fmt = params.format || 'vtt'
  const qs = new URLSearchParams()
  qs.set('api_key', accessToken)
  qs.set('DeviceId', deviceId)
  return `${base}/Videos/${params.itemId}/${params.mediaSourceId}/Subtitles/${params.subtitleStreamIndex}/Stream.${fmt}?${qs.toString()}`
}

export type { MediaStream, DeviceProfile }
