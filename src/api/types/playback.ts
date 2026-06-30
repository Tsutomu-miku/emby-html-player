import type { MediaAttachment } from './item'

export interface MediaSourceInfo {
  id: string
  protocol?: 'File' | 'Http' | 'Rtmp' | 'Rtsp' | 'Udp'
  mediaStreams: MediaStream[]
  path?: string
  container?: string
  size?: number
  name?: string
  isRemote?: boolean
  runTimeTicks?: number
  /** 对于 progressive stream 的直接 URL（可选） */
  directStreamUrl?: string
  supportsDirectPlay?: boolean
  supportsDirectStream?: boolean
  supportsTranscoding?: boolean
  transcodingUrl?: string
  transcodingContainer?: string
  /** 若转码，可选子协议：hls | dash | ts | mp4 */
  transcodingSubProtocol?: string
  eTag?: string
  bitrate?: number
  video3DFormat?: string
  mediaAttachments?: MediaAttachment[]
  analyzeDurationMs?: number
  timestamp?: 'None' | 'Zero' | 'Valid'
  /** 若开启直播流 ID（LiveStreamId） */
  liveStreamId?: string
  /** 默认音频流索引（DefaultAudioStreamIndex） */
  defaultAudioStreamIndex?: number
  /** 默认字幕流索引（DefaultSubtitleStreamIndex） */
  defaultSubtitleStreamIndex?: number
}

export interface MediaStream {
  codec?: string
  codecTimeBase?: string
  language?: string
  languageTag?: string
  displayTitle?: string
  displayLanguage?: string
  nalLengthSize?: number
  isDefault?: boolean
  isForced?: boolean
  height?: number
  width?: number
  averageFrameRate?: number
  realFrameRate?: number
  /** 水平像素宽高比 */
  aspectRatio?: string
  isAnamorphic?: boolean
  bitDepth?: number
  videoRange?: string
  colorSpace?: string
  colorTransfer?: string
  colorPrimaries?: string
  profile?: string
  type: 'Audio' | 'Video' | 'Subtitle' | 'Data'
  index: number
  channels?: number
  sampleRate?: number
  bitRate?: number
  channelLayout?: string
  title?: string
  /** 字幕 Delivery */
  isExternal?: boolean
  path?: string
  deliveryMethod?: SubtitleDeliveryMethod
  deliveryUrl?: string
  codecTimeBaseTicks?: number
  supportsInterlacedDecoding?: boolean
  /** 是否为文本字幕流（非图片格式字幕）——浏览器可直接显示 */
  isTextSubtitleStream?: boolean
}

export type SubtitleDeliveryMethod =
  | 'Encode'
  | 'Embed'
  | 'External'
  | 'Hls'
  | 'Drop'
  | (string & {})

/** PlaybackInfo 请求 */
export interface PlaybackInfoRequest {
  userId?: string
  maxStreamingBitrate?: number
  startTimeTicks?: number
  audioStreamIndex?: number
  subtitleStreamIndex?: number
  maxAudioChannels?: number
  mediaSourceId?: string
  liveStreamId?: string
  deviceProfile?: DeviceProfile
  enableDirectPlay?: boolean
  enableDirectStream?: boolean
  enableTranscoding?: boolean
  allowVideoStreamCopy?: boolean
  allowAudioStreamCopy?: boolean
  autoOpenLiveStream?: boolean
}

export interface PlaybackInfoResponse {
  mediaSources: MediaSourceInfo[]
  playSessionId?: string
  errorCode?: 'NotAllowed' | 'NoCompatibleStream' | 'RateLimitExceeded' | 'DeviceUntrusted'
}

/** 上报播放进度/开始/停止 */
export interface PlaybackProgressEvent {
  itemId: string
  playSessionId?: string
  mediaSourceId?: string
  audioStreamIndex?: number
  subtitleStreamIndex?: number
  isPaused?: boolean
  isMuted?: boolean
  positionTicks?: number
  volumeLevel?: number
  playbackStartTimeTicks?: number
  bufferedRanges?: BufferRangeDto[]
  playMethod?: PlayMethod
  repeatMode?: 'RepeatNone' | 'RepeatOne' | 'RepeatAll'
  nowPlayingQueue?: QueueItem[]
  playlistItemId?: string
}

export interface BufferRangeDto {
  start: number
  end: number
}

export interface QueueItem {
  id: string
  playlistItemId?: string
}

export type PlayMethod = 'DirectPlay' | 'DirectStream' | 'Transcode'

/** 非常精简的 DeviceProfile —— Emby/转码器用来决定容器/编码 */
export interface DeviceProfile {
  name?: string
  maxStaticBitrate?: number
  maxStreamingBitrate?: number
  musicStreamingTranscodingBitrate?: number
  directPlayProfiles?: DirectPlayProfile[]
  transcodingProfiles?: TranscodingProfile[]
  subtitleProfiles?: SubtitleProfile[]
  codecProfiles?: CodecProfile[]
  containerProfiles?: ContainerProfile[]
}

export interface DirectPlayProfile {
  container?: string
  type?: 'Video' | 'Audio' | 'Photo'
  videoCodec?: string
  audioCodec?: string
}

export interface TranscodingProfile {
  container: string
  type: 'Video' | 'Audio' | 'Photo'
  videoCodec?: string
  audioCodec?: string
  protocol?: string
  maxAudioChannels?: string
  minSegments?: number
  context?: 'Streaming' | 'Static'
  enableMpegtsM2TsMode?: boolean
  transcodeSeekInfo?: 'Auto' | 'Bytes'
  estimateContentLength?: boolean
  enableSubtitlesInManifest?: boolean
  breakOnNonKeyFrames?: boolean
  conditions?: ProfileCondition[]
}

export interface SubtitleProfile {
  format?: string
  method: SubtitleDeliveryMethod
  didlMode?: string
  language?: string
  container?: string
  conditions?: ProfileCondition[]
}

export interface CodecProfile {
  type: 'Video' | 'VideoAudio' | 'Audio'
  conditions?: ProfileCondition[]
  applyConditions?: ProfileCondition[]
  codec?: string
  container?: string
}

export interface ContainerProfile {
  type: 'Video' | 'Audio' | 'Photo'
  conditions?: ProfileCondition[]
  container?: string
}

export interface ProfileCondition {
  condition: 'Equals' | 'NotEquals' | 'LessThanEqual' | 'GreaterThanEqual' | 'EqualsAny'
  property: ProfileConditionValue
  value?: string
  isRequired?: boolean
}

export type ProfileConditionValue =
  | 'AudioChannels'
  | 'AudioBitrate'
  | 'AudioProfile'
  | 'Width'
  | 'Height'
  | 'Has64BitOffsets'
  | 'PacketLength'
  | 'VideoBitDepth'
  | 'VideoBitrate'
  | 'VideoFramerate'
  | 'VideoLevel'
  | 'VideoProfile'
  | 'VideoCodecTag'
  | 'IsAnamorphic'
  | 'RefFrames'
  | 'NumAudioStreams'
  | 'NumVideoStreams'
  | 'IsSecondaryAudio'
  | 'VideoRange'
  | 'VideoRangeType'
