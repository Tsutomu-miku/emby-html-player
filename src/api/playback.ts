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

/** 浏览器/设备播放能力描述，用于 PlaybackInfo 转码协商。
 * 注意：这里字段均使用 camelCase，http.ts 会在发送前递归转换为 PascalCase。
 * （嵌套类型条件 Condition/Property 等枚举值本身是 Emby 服务端约定的字符串，保持 PascalCase。）
 */
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
    name: 'Emby H5 Player',
    maxStreamingBitrate: 20_000_000,
    maxStaticBitrate: 40_000_000,
    musicStreamingTranscodingBitrate: 384_000,
    directPlayProfiles: [
      {
        container: directPlayContainers.join(','),
        type: 'Video',
        videoCodec: directPlayVideoCodecs.join(','),
        audioCodec: directAudioCodecs.join(','),
      },
      {
        container: 'mp3',
        type: 'Audio',
        audioCodec: 'mp3',
      },
      {
        container: 'aac',
        type: 'Audio',
        audioCodec: 'aac',
      },
      {
        container: 'flac',
        type: 'Audio',
        audioCodec: 'flac',
      },
      {
        container: 'opus',
        type: 'Audio',
        audioCodec: 'opus',
      },
    ],
    transcodingProfiles: [
      {
        container: canNativeHls ? 'ts' : 'aac', // ts 用于视频转码，aac 用于音频
        type: 'Video',
        audioCodec: transcodeAudioCodec,
        videoCodec: transcodeVideoCodec,
        protocol: 'http',
        maxAudioChannels: '6',
        minSegments: 2,
        breakOnNonKeyFrames: true,
      },
      {
        container: 'aac',
        type: 'Audio',
        audioCodec: 'aac',
        protocol: 'http',
      },
      {
        container: 'mp3',
        type: 'Audio',
        audioCodec: 'mp3',
        protocol: 'http',
      },
      {
        container: 'm3u8',
        type: 'Video',
        audioCodec: transcodeAudioCodec,
        videoCodec: transcodeVideoCodec,
        protocol: 'hls',
        maxAudioChannels: '6',
        minSegments: 2,
        enableSubtitlesInManifest: true,
        breakOnNonKeyFrames: true,
      },
    ],
    subtitleProfiles: [
      // 注意：format / didlMode 是字符串值，保持 Emby 约定（不是 key，不会被转换）
      { format: 'vtt', method: 'External', didlMode: 'SUBTITLE' },
      { format: 'subrip', method: 'External' },
      { format: 'srt', method: 'External' },
      { format: 'ass', method: 'External' },
      { format: 'ssa', method: 'External' },
      { format: 'pgssub', method: 'Hls' },
      { format: 'dvdsub', method: 'Hls' },
      { format: 'sub', method: 'External' },
      { format: 'ttml', method: 'External' },
    ],
    codecProfiles: [
      {
        type: 'Video',
        codec: 'h264',
        conditions: [
          // Condition/Property/Value 是字符串枚举（非字段名），保持 PascalCase
          { condition: 'LessThanEqual', property: 'Width', value: '3840', isRequired: false },
          { condition: 'LessThanEqual', property: 'Height', value: '2160', isRequired: false },
          { condition: 'LessThanEqual', property: 'VideoLevel', value: '52', isRequired: false },
        ],
      },
      {
        type: 'VideoAudio',
        codec: 'aac,mp3,mp2,opus,flac',
        conditions: [
          { condition: 'LessThanEqual', property: 'AudioChannels', value: '8', isRequired: false },
        ],
      },
    ],
  } as DeviceProfile
}

/**
 * 获取 PlaybackInfo：Emby 决定返回哪些 media sources，以及转码 URL。
 *
 * 这里 params、body 均写 camelCase，由 http.ts 统一转 PascalCase。
 * 注意：值 StartTimeTicks/UserId 等本来就是整数/字符串，转换的是「key」，值不受影响。
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
    // key 用 camelCase，会被转换为 StartTimeTicks / UserId
    params: { startTimeTicks: body.startTimeTicks ?? 0, userId },
    body,
  })
}

/** 关闭直播（仅当 PlaybackInfo 返回了 LiveStreamId 时需要） */
export function closeLiveStream(liveStreamId: string) {
  return request(`/LiveStreams/Close`, {
    method: 'POST',
    // key 会被转换为 LiveStreamId
    params: { liveStreamId },
  })
}

/**
 * 根据 MediaSourceInfo 决定最终播放 URL 和播放方式（DirectPlay/DirectStream/Transcode）。
 *
 * 关键健壮性修复：
 *  - method=Transcode：若转码 URL 缺少 PlaySessionId，强制塞入。
 *  - method=DirectPlay：directStreamUrl 经 appendAuth 确保有 api_key / DeviceId。
 *  - method=Transcode 时会把媒体源内的 liveStreamId 一并返回，便于结束后关闭直播流。
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
  const base = (server || '').replace(/\/+$/, '')

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
    // 强制塞入 PlaySessionId：只要有 playSessionId 就一定加上，否则某些 Emby 版本会返回 400
    if (playSessionId) {
      url.searchParams.set('PlaySessionId', playSessionId)
    }
    if (startTimeTicks) {
      url.searchParams.set('StartTimeTicks', String(startTimeTicks))
    }
    return {
      url: url.toString(),
      method: 'Transcode',
      liveStreamId: mediaSource.liveStreamId,
    }
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
    url: base ? `${base}/Videos/${itemId}/stream${ext}?${qs}` : '',
    method: 'DirectStream',
    liveStreamId: mediaSource.liveStreamId,
  }
  void userId
}

/** 为已有 URL 追加 api_key / DeviceId（若未出现），保留 fragment。 */
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
  const base = (server || '').replace(/\/+$/, '')
  if (!base) return ''
  const fmt = params.format || 'vtt'
  const qs = new URLSearchParams()
  qs.set('api_key', accessToken)
  qs.set('DeviceId', deviceId)
  return `${base}/Videos/${params.itemId}/${params.mediaSourceId}/Subtitles/${params.subtitleStreamIndex}/Stream.${fmt}?${qs.toString()}`
}

export type { MediaStream, DeviceProfile }
