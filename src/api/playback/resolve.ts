import type { MediaSourceInfo, PlayMethod } from '../types'
import { useAuthStore } from '@/store/auth'

export class UnplayableSourceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnplayableSourceError'
  }
}

export function resolveEmbeddedPlaybackUrl(itemId: string, mediaSource: MediaSourceInfo): string {
  const { accessToken, deviceId, server } = useAuthStore.getState()
  const base = (server || '').replace(/\/+$/, '')
  if (mediaSource.protocol === 'File') {
    const url = new URL(`${base}/Items/${itemId}/File`)
    if (mediaSource.id) url.searchParams.set('MediaSourceId', mediaSource.id)
    return appendAuth(url.toString(), accessToken, deviceId)
  }
  const url = mediaSource.directStreamUrl ?? mediaSource.transcodingUrl
  if (!url) {
    throw new UnplayableSourceError('服务器未返回可供原生播放器使用的媒体 URL')
  }
  return makeAbsolute(base, appendAuth(url, accessToken, deviceId))
}

/**
 * 根据 MediaSourceInfo 决定最终播放 URL 和播放方式（DirectPlay/DirectStream/Transcode）。
 *
 * 关键健壮性修复：
 *  - method=Transcode：若转码 URL 缺少 PlaySessionId，强制塞入。
 *  - method=DirectPlay：directStreamUrl 经 appendAuth 确保有 api_key / DeviceId。
 *  - method=Transcode 时会把媒体源内的 liveStreamId 一并返回，便于结束后关闭直播流。
 *  - 不手拼服务端未返回的 stream.mp4；某些反代会把这类 URL 拦成 HTML 403。
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
  preferredMethod?: PlayMethod
}): { url: string; method: PlayMethod; liveStreamId?: string } {
  const {
    itemId,
    mediaSource,
    playSessionId,
    audioStreamIndex,
    subtitleStreamIndex,
    maxBitrate = 20_000_000,
    startTimeTicks = 0,
    preferredMethod,
  } = params

  const auth = {
    ...useAuthStore.getState(),
    userId: params.userId ?? useAuthStore.getState().userId,
  }
  const { accessToken, deviceId, server } = auth
  void auth.userId // params.userId 被合并到 auth 中，保持接口契约但内部未使用
  const base = (server || '').replace(/\/+$/, '')
  const browserPlayable = isBrowserPlayableSource(mediaSource)

  // 1. 转码优先：调用方明确要求 Transcode 时，不允许 DirectPlay 抢回 CDN 直链。
  if (preferredMethod === 'Transcode' && mediaSource.supportsTranscoding && mediaSource.transcodingUrl) {
    return resolveTranscodeUrl({
      base,
      url: mediaSource.transcodingUrl,
      accessToken,
      deviceId,
      playSessionId,
      startTimeTicks,
      liveStreamId: mediaSource.liveStreamId,
    })
  }

  // 2. DirectStream：只使用浏览器原生可播的静态流。
  // Emby 有时会把 MKV 原始地址也标成 SupportsDirectStream=true，但 Chromium 不能直接播放 MKV；
  // 若服务端没返回 TranscodingUrl，不能手拼 stream.mp4 冒充 remux。
  if (preferredMethod === 'DirectStream' && mediaSource.supportsDirectStream && browserPlayable) {
    return resolveDirectStreamUrl({
      base,
      itemId,
      mediaSource,
      accessToken,
      deviceId,
      playSessionId,
      audioStreamIndex,
      subtitleStreamIndex,
      maxBitrate,
      startTimeTicks,
    })
  }

  // 3. DirectPlay
  if (
    preferredMethod !== 'Transcode' &&
    browserPlayable &&
    mediaSource.supportsDirectPlay &&
    mediaSource.directStreamUrl
  ) {
    return {
      url: makeAbsolute(base, appendAuth(mediaSource.directStreamUrl, accessToken, deviceId)),
      method: 'DirectPlay',
      liveStreamId: undefined,
    }
  }

  // 4. 转码
  if (mediaSource.supportsTranscoding && mediaSource.transcodingUrl) {
    return resolveTranscodeUrl({
      base,
      url: mediaSource.transcodingUrl,
      accessToken,
      deviceId,
      playSessionId,
      startTimeTicks,
      liveStreamId: mediaSource.liveStreamId,
    })
  }

  if (preferredMethod === 'Transcode') {
    throw new Error('服务器未返回可用的转码播放地址')
  }

  if (!browserPlayable) {
    throw new UnplayableSourceError(buildUnplayableSourceMessage(mediaSource))
  }

  // 5. 退回 DirectStream：仅限浏览器可播容器的静态流。
  return resolveDirectStreamUrl({
    base,
    itemId,
    mediaSource,
    accessToken,
    deviceId,
    playSessionId,
    audioStreamIndex,
    subtitleStreamIndex,
    maxBitrate,
    startTimeTicks,
  })
}

function resolveDirectStreamUrl(params: {
  base: string
  itemId: string
  mediaSource: MediaSourceInfo
  accessToken: string
  deviceId: string
  playSessionId?: string
  audioStreamIndex?: number
  subtitleStreamIndex?: number
  maxBitrate: number
  startTimeTicks: number
}): { url: string; method: PlayMethod; liveStreamId?: string } {
  const {
    base,
    mediaSource,
    accessToken,
    deviceId,
  } = params
  if (!mediaSource.directStreamUrl) {
    throw new Error('PlaybackInfo 未返回 DirectStreamUrl，禁止手拼 stream 播放地址')
  }
  return {
    url: makeAbsolute(base, appendAuth(mediaSource.directStreamUrl, accessToken, deviceId)),
    method: 'DirectStream',
    liveStreamId: mediaSource.liveStreamId,
  }
}

function getPrimaryContainer(mediaSource: MediaSourceInfo): string {
  return mediaSource.container?.split(',')[0]?.toLowerCase() || 'mp4'
}

function isBrowserPlayableSource(mediaSource: MediaSourceInfo): boolean {
  const container = getPrimaryContainer(mediaSource)
  if (!['mp4', 'm4v', 'mov'].includes(container)) return false
  const video = mediaSource.mediaStreams.find((stream) => stream.type === 'Video')
  const audio = mediaSource.mediaStreams.find((stream) => stream.type === 'Audio')
  const videoCodec = video?.codec?.toLowerCase()
  const audioCodec = audio?.codec?.toLowerCase()
  const videoOk = !videoCodec || ['h264', 'hevc', 'h265', 'av1', 'vp9'].includes(videoCodec)
  const audioOk = !audioCodec || ['aac', 'mp3', 'mp2', 'opus', 'flac'].includes(audioCodec)
  return videoOk && audioOk
}

function buildUnplayableSourceMessage(mediaSource: MediaSourceInfo): string {
  const container = getPrimaryContainer(mediaSource).toUpperCase()
  const video = mediaSource.mediaStreams.find((stream) => stream.type === 'Video')
  const audio = mediaSource.mediaStreams.find((stream) => stream.type === 'Audio')
  const videoCodec = video?.codec?.toUpperCase() ?? 'unknown'
  const audioCodec = audio?.codec?.toUpperCase() ?? 'unknown'
  return [
    `当前媒体是 ${container} 容器（${videoCodec} / ${audioCodec}），`,
    'Electron/Chromium 不能直接播放该容器，',
    '且 Emby PlaybackInfo 未返回可用转码地址。',
  ].join('')
}

function resolveTranscodeUrl(params: {
  base: string
  url: string
  accessToken: string
  deviceId: string
  playSessionId?: string
  startTimeTicks: number
  liveStreamId?: string
}): { url: string; method: PlayMethod; liveStreamId?: string } {
  const url = new URL(
    makeAbsolute(params.base, appendAuth(params.url, params.accessToken, params.deviceId)),
  )
  if (params.playSessionId) {
    url.searchParams.set('PlaySessionId', params.playSessionId)
  }
  if (params.startTimeTicks) {
    url.searchParams.set('StartTimeTicks', String(params.startTimeTicks))
  }
  return {
    url: url.toString(),
    method: 'Transcode',
    liveStreamId: params.liveStreamId,
  }
}

/** 为已有 URL 追加 api_key / DeviceId（若未出现），保留 fragment。 */
function appendAuth(url: string, accessToken: string, deviceId: string): string {
  const [prefix, fragment = ''] = url.split('#')
  const [pathPart, query = ''] = prefix.split('?')
  const qsParams = new URLSearchParams(query)
  if (!qsParams.has('api_key') && !qsParams.has('X-Emby-Token')) {
    qsParams.set('api_key', accessToken)
  }
  if (!qsParams.has('DeviceId')) qsParams.set('DeviceId', deviceId)
  const qs = qsParams.toString()
  return `${pathPart}${qs ? `?${qs}` : ''}${fragment ? `#${fragment}` : ''}`
}

function makeAbsolute(base: string, url: string): string {
  if (/^https?:/i.test(url)) return url
  if (url.startsWith('//')) return `https:${url}`
  return `${base}${url.startsWith('/') ? url : `/${url}`}`
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
