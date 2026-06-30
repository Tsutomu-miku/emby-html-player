import { request } from '../http'
import type {
  PlaybackInfoRequest,
  PlaybackInfoResponse,
  PlaybackProgressEvent,
} from '../types'
import { buildDeviceProfile } from './device'
import { ensureSessionCapabilities } from './session'

/**
 * 获取 PlaybackInfo：Emby 决定返回哪些 media sources，以及转码 URL。
 *
 * 这里 params、body 均写 camelCase，由 http.ts 统一转 PascalCase。
 * 注意：值 StartTimeTicks/UserId 等本来就是整数/字符串，转换的是「key」，值不受影响。
 */
export async function getPlaybackInfo(
  userId: string,
  itemId: string,
  mediaSourceId?: string,
  extra: Partial<PlaybackInfoRequest> = {},
): Promise<PlaybackInfoResponse> {
  const deviceProfile = extra.deviceProfile ?? buildDeviceProfile()
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
    deviceProfile,
    liveStreamId: extra.liveStreamId,
  }
  await ensureSessionCapabilities(deviceProfile)
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

/** 上报播放开始 */
export function reportPlaybackStart(ev: PlaybackProgressEvent) {
  return request(`/Sessions/Playing`, {
    method: 'POST',
    body: ev,
  })
}

/** 上报播放进度 */
export function reportPlaybackProgress(ev: PlaybackProgressEvent) {
  const cleaned = { ...ev }
  if (Array.isArray(cleaned.bufferedRanges) && cleaned.bufferedRanges.length === 0) {
    delete (cleaned as Partial<PlaybackProgressEvent>).bufferedRanges
  }
  if (Array.isArray(cleaned.nowPlayingQueue) && cleaned.nowPlayingQueue.length === 0) {
    delete (cleaned as Partial<PlaybackProgressEvent>).nowPlayingQueue
  }
  return request(`/Sessions/Playing/Progress`, {
    method: 'POST',
    body: cleaned,
  })
}

/** 上报播放停止 */
export function reportPlaybackStop(ev: PlaybackProgressEvent) {
  return request(`/Sessions/Playing/Stopped`, {
    method: 'POST',
    body: ev,
  })
}
