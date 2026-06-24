import { request, buildQuery } from './http'
import type {
  BaseItemDto,
  QueryResult,
  GetItemsParams,
  SearchHintResult,
} from './types'
import type { UserView } from './users'
import { getUserViews } from './users'

export const DEFAULT_FIELDS = [
  'PrimaryImageAspectRatio',
  'BasicSyncInfo',
  'CanDelete',
  'CanDownload',
  'ChannelInfo',
  'ProductionYear',
  'PremiereDate',
  'EndDate',
  'Overview',
  'EpisodeTitle',
  'Genres',
  'Studios',
  'People',
  'AirTime',
  'MediaStreams',
  'SeasonUserData',
  'ProviderIds',
  'Width',
  'Height',
  'RunTimeTicks',
  'Taglines',
  'CommunityRating',
  'DateLastMediaAdded',
  'OfficialRating',
]

export function withDefaultFields(params: GetItemsParams = {}): GetItemsParams {
  return {
    fields: params.fields ?? DEFAULT_FIELDS.join(','),
    enableImages: params.enableImages ?? true,
    enableUserData: params.enableUserData ?? true,
    imageTypeLimit: params.imageTypeLimit ?? 1,
    enableImageTypes: params.enableImageTypes ?? 'Primary,Backdrop,Thumb,Logo',
    ...params,
  }
}

/** 获取媒体库列表（兼容 getUserViews） */
export { getUserViews }
export type { UserView }

/** 通用 Items 查询 */
export function getItems(
  userId: string,
  params: GetItemsParams = {},
): Promise<QueryResult<BaseItemDto>> {
  const q = withDefaultFields({ ...params, userId, recursive: params.recursive ?? true })
  return request<QueryResult<BaseItemDto>>(`/Users/${userId}/Items`, {
    params: q as Record<string, any>,
  })
}

/** 获取单个条目详情 */
export function getItem(
  userId: string,
  itemId: string,
  params: GetItemsParams = {},
): Promise<BaseItemDto> {
  return request<BaseItemDto>(`/Users/${userId}/Items/${itemId}`, {
    params: withDefaultFields(params) as Record<string, any>,
  })
}

/** 获取某个系列的全部季 */
export function getSeasons(
  userId: string,
  seriesId: string,
  params: GetItemsParams = {},
): Promise<QueryResult<BaseItemDto>> {
  return getItems(userId, {
    parentId: seriesId,
    includeItemTypes: 'Season',
    sortBy: 'IndexNumber',
    sortOrder: 'Ascending',
    ...params,
  })
}

/** 获取季中的剧集，或系列中某季的剧集 */
export function getEpisodes(
  userId: string,
  seriesId: string,
  seasonId?: string,
  params: GetItemsParams = {},
): Promise<QueryResult<BaseItemDto>> {
  return getItems(userId, {
    parentId: seasonId ?? seriesId,
    seriesId,
    includeItemTypes: 'Episode',
    sortBy: 'ParentIndexNumber,IndexNumber',
    sortOrder: 'Ascending',
    ...params,
  })
}

/** 继续观看（未看完的） */
export function getResumeItems(
  userId: string,
  params: GetItemsParams = {},
): Promise<QueryResult<BaseItemDto>> {
  return request<QueryResult<BaseItemDto>>(`/Users/${userId}/Items/Resume`, {
    params: {
      ...withDefaultFields(params),
      enableImages: true,
      imageTypeLimit: 1,
      mediaTypes: 'Video',
      limit: params.limit ?? 24,
    } as Record<string, any>,
  })
}

/** 下一集：根据用户（继续观看 + 最新一集） */
export function getNextUp(
  userId: string,
  params: GetItemsParams = {},
): Promise<QueryResult<BaseItemDto>> {
  return request<QueryResult<BaseItemDto>>(`/Shows/NextUp`, {
    params: {
      userId,
      ...withDefaultFields(params),
      limit: params.limit ?? 24,
      disableFirstEpisode: true,
      nextUpDateCutoff: '0001-01-01T00:00:00Z',
    } as Record<string, any>,
  })
}

/** 最新添加（带限制） */
export function getLatestItems(
  userId: string,
  parentId?: string,
  params: GetItemsParams = {},
): Promise<BaseItemDto[]> {
  return request<BaseItemDto[]>(`/Users/${userId}/Items/Latest`, {
    params: {
      userId,
      parentId,
      ...withDefaultFields(params),
      limit: params.limit ?? 24,
      groupItemsIntoCollections: true,
    } as Record<string, any>,
  })
}

/** 相似推荐 */
export function getSimilarItems(
  userId: string,
  itemId: string,
  params: GetItemsParams = {},
): Promise<QueryResult<BaseItemDto>> {
  return request<QueryResult<BaseItemDto>>(`/Items/${itemId}/Similar`, {
    params: {
      userId,
      ...withDefaultFields(params),
      limit: params.limit ?? 24,
    } as Record<string, any>,
  })
}

/** 按类型获取推荐（类似首页的推荐行） */
export function getRecommendations(
  userId: string,
  categoryLimit = 6,
  itemLimit = 10,
): Promise<
  {
    baselineItemName?: string
    baselineItemId?: string
    categoryId?: number
    items: BaseItemDto[]
    recommendationType?: string
  }[]
> {
  return request(`/Movies/Recommendations`, {
    params: {
      userId,
      categoryLimit,
      itemLimit,
      Fields: DEFAULT_FIELDS.join(','),
      EnableImages: true,
      ImageTypeLimit: 1,
    },
  }) as Promise<any>
}

/** 类型种类（Genres） */
export function getGenres(
  userId: string,
  params: GetItemsParams = {},
): Promise<QueryResult<BaseItemDto>> {
  return request<QueryResult<BaseItemDto>>(`/Genres`, {
    params: {
      userId,
      ...withDefaultFields(params),
    } as Record<string, any>,
  })
}

/** 按年份 / 类型 / 评分 浏览（通用）—— 直接用 getItems 即可。 */

/** 搜索（多类型） */
export function searchHints(
  userId: string,
  searchTerm: string,
  opts: {
    includeItemTypes?: string
    limit?: number
  } = {},
): Promise<SearchHintResult> {
  return request<SearchHintResult>(`/Search/Hints`, {
    params: {
      userId,
      searchTerm,
      includeItemTypes: opts.includeItemTypes,
      limit: opts.limit ?? 24,
      isPlayable: true,
      enableTotalRecordCount: true,
    },
  })
}

/** 收藏 / 取消收藏 */
export function markFavorite(userId: string, itemId: string, favorite = true) {
  const method = favorite ? 'POST' : 'DELETE'
  return request(`/Users/${userId}/FavoriteItems/${itemId}`, { method })
}

/** 标记已看 / 未看 */
export function markPlayed(userId: string, itemId: string, played = true) {
  const method = played ? 'POST' : 'DELETE'
  return request(`/Users/${userId}/PlayedItems/${itemId}`, { method })
}

export { buildQuery }
