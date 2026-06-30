import type { NameIdPair } from './user'
import type { MediaSourceInfo, MediaStream } from './playback'

export type SubtitleMode =
  | 'Default'
  | 'Always'
  | 'OnlyForced'
  | 'OnlyForeign'
  | 'Smart'
  | 'None'

export type IntroSkipMode =
  | 'None'
  | 'Auto'
  | 'ShowButton'
  | 'Ask'

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
  playAccess?: 'Full' | (string & {})
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
