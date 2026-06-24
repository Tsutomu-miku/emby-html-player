// ===== 公共类型：Emby HTTP API 返回的核心数据结构 =====
// 参考 Jellyfin/Emby Web 客户端的 dto，字段命名沿用 Emby 风格（PascalCase），
// 但因为 camelCase 更常用，我们在 HTTP 客户端里会自动做转换。
// 为了实现简单，这里所有接口都使用 camelCase。

export interface PublicSystemInfo {
  serverName: string
  version: string
  productName: string
  id: string
  startupWizardCompleted?: boolean
}

export interface NameIdPair {
  name: string
  id: string
}

export interface AuthenticationResult {
  user?: UserDto
  accessToken?: string
  serverId?: string
}

export interface UserDto {
  id: string
  name: string
  serverId?: string
  hasPassword?: boolean
  hasConfiguredPassword?: boolean
  primaryImageTag?: string
  primaryImageAspectRatio?: number
  policy?: UserPolicy
  configuration?: UserConfiguration
  /** 最近登录时间（ISO 字符串） */
  lastLoginDate?: string
  /** 最近活动时间（ISO 字符串） */
  lastActivityDate?: string
}

export interface UserPolicy {
  isAdministrator?: boolean
  isHidden?: boolean
  enableAllFolders?: boolean
  enabledFolders?: string[]
  maxParentalRating?: number
}

export interface UserConfiguration {
  displayMissingEpisodes?: boolean
  subtitleLanguagePreference?: string
  playDefaultAudioTrack?: boolean
}

/** 媒体库视图（Movies / TVShows / Music / Collections 等） */
export interface BaseItemDto {
  id: string
  name?: string
  originalTitle?: string
  overview?: string
  tagline?: string
  type?: ItemType
  collectionType?: CollectionType
  /** 父级 / 系列 / 季 ID */
  seriesId?: string
  seasonId?: string
  parentId?: string
  seriesName?: string
  seasonName?: string
  parentIndexNumber?: number // season number
  indexNumber?: number // episode number
  indexNumberEnd?: number
  productionYear?: number
  premiereDate?: string
  endDate?: string
  runTimeTicks?: number
  playAccess?: 'Full' | string
  /** 是否文件夹（合集/季/系列容器等） */
  isFolder?: boolean
  /** 图片数量：{ Primary: n, Backdrop: n, Logo: n, Thumb: n } */
  imageTags?: Record<string, string>
  backdropImageTags?: string[]
  screenshotImageTags?: string[]
  parentLogoImageTag?: string
  parentLogoItemId?: string
  parentBackdropImageTags?: string[]
  parentBackdropItemId?: string
  userData?: UserItemDataDto
  people?: (BaseItemPerson & { type?: PersonKind })[]
  studios?: NameIdPair[]
  genres?: string[]
  tags?: string[]
  providerIds?: Record<string, string>
  /** 社区评分（如 TMDB 0-10 */
  communityRating?: number
  /** 官方分级（如 PG-13、TV-14、TV-MA） */
  officialRating?: string
  /** 影评人评分（烂番茄/Metacritic 等 */
  criticRating?: number
  /** 评分累计评价数量 */
  voteCount?: number
  /** 电视剧：季数 */
  childCount?: number
  /** 播放信息：是否可播放 */
  canDownload?: boolean
  mediaSources?: MediaSourceInfo[]
  mediaStreams?: MediaStream[]
  videoType?: 'VideoFile' | 'Iso' | 'Dvd' | 'BluRay'
  locationType?: 'FileSystem' | 'Virtual' | 'Offline' | 'Remote'
  mediaType?: MediaType
  /** 若为 episode，其首播日期字符串 */
  dateCreated?: string
  artists?: NameIdPair[]
  album?: string
  albumId?: string
  albumImageTag?: string
  albumPrimaryImageTag?: string
  // 音乐
  trackCount?: number
  audio?: MediaStream[]
}

export type CollectionType =
  | 'movies'
  | 'tvshows'
  | 'music'
  | 'musicvideos'
  | 'trailers'
  | 'homevideos'
  | 'boxsets'
  | 'books'
  | 'photos'
  | 'liveTv'
  | 'playlists'
  | 'folders'
  | (string & {})

export type MediaType = 'Video' | 'Audio' | 'Photo' | 'Book' | (string & {})

export type ItemType =
  | 'AggregateFolder'
  | 'Folder'
  | 'CollectionFolder'
  | 'UserView'
  | 'Movie'
  | 'Series'
  | 'Season'
  | 'Episode'
  | 'Trailer'
  | 'MusicVideo'
  | 'Video'
  | 'Audio'
  | 'MusicAlbum'
  | 'MusicArtist'
  | 'Book'
  | 'Photo'
  | 'PhotoAlbum'
  | 'Playlist'
  | 'BoxSet'
  | (string & {})

export type PersonKind = 'Actor' | 'Director' | 'Writer' | 'Composer' | 'GuestStar' | 'Producer' | (string & {})

export interface BaseItemPerson {
  name: string
  id?: string
  role?: string
  primaryImageTag?: string
}

/** 用户播放数据：播放位置、是否看过、收藏等 */
export interface UserItemDataDto {
  rating?: number
  playedPercentage?: number
  playbackPositionTicks?: number
  playCount?: number
  isFavorite?: boolean
  likes?: boolean
  lastPlayedDate?: string
  played?: boolean
  key?: string
}

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

export interface MediaAttachment {
  codec?: string
  codecTag?: string
  comment?: string
  index: number
  fileName?: string
  mimeType?: string
  deliveryUrl?: string
}

export interface QueryResult<T> {
  items: T[]
  totalRecordCount: number
  startIndex?: number
}

/** Items 接口常用查询参数子集 */
export interface GetItemsParams {
  parentId?: string
  user?: string
  userId?: string
  startIndex?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'Ascending' | 'Descending'
  filters?: string
  fields?: string
  includeItemTypes?: string
  excludeItemTypes?: string
  recursive?: boolean
  searchTerm?: string
  mediaTypes?: string
  isPlayed?: boolean
  isFavorite?: boolean
  genres?: string
  years?: string
  tags?: string
  officialRatings?: string
  minCommunityRating?: number
  maxCommunityRating?: number
  minCriticRating?: number
  imageTypeLimit?: number
  enableImageTypes?: string
  enableImages?: boolean
  enableUserData?: boolean
  /** 合集：传入 seriesId 返回其季 */
  seriesId?: string
  seasonId?: string
  parentIndexNumber?: number
  adjacentTo?: string
}

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
  sessionId?: string
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

/** Emby API /Search 常用 */
export interface SearchHint {
  itemId: string
  id?: string
  name?: string
  matchedTerm?: string
  indexNumber?: number
  productionYear?: number
  primaryImageTag?: string
  thumbImageTag?: string
  thumbImageItemId?: string
  backdropImageTag?: string
  backdropImageItemId?: string
  type?: ItemType
  isFolder?: boolean
  runTimeTicks?: number
  mediaType?: MediaType
  startDate?: string
  endDate?: string
  series?: string
  status?: string
  album?: string
  albumId?: string
  albumArtist?: string
  artists?: string[]
  songCount?: number
  episodeCount?: number
  channelName?: string
  channelId?: string
  primaryImageAspectRatio?: number
  overview?: string
}

export interface SearchHintResult {
  searchHints: SearchHint[]
  totalRecordCount: number
}
