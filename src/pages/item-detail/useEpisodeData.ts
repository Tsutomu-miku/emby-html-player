import { useState, useEffect, useMemo } from 'react'
import type { BaseItemDto, ItemType, QueryResult } from '@/api/types'
import { getSeasons, getEpisodes, getItem } from '@/api/library'
import { useAsync } from '@/hooks/useAsync'

/**
 * 管理 ItemDetailPage 中与季/剧集/同季相关的异步数据与选中状态：
 *  - Series 类型：seasons + 选中季 + 该季 episodes
 *  - Season 类型：该季 episodes + 所属 series
 *  - Episode 类型：所属 series + 同季 episodes（上/下一集）
 */
export function useEpisodeData(
  userId: string,
  item: BaseItemDto | undefined,
  type: ItemType | undefined,
) {
  const itemId = item?.id ?? ''

  // Series 的 seasons 列表
  const seasonsState = useAsync<QueryResult<BaseItemDto>>(
    async () =>
      userId && itemId && type === 'Series'
        ? getSeasons(userId, itemId)
        : { items: [], totalRecordCount: 0 },
    [userId, itemId, type],
  )

  const seasons = seasonsState.data?.items || []

  // 默认选中季：有播放进度的季 > 第一季
  const defaultSeasonId = useMemo(() => {
    if (seasons.length === 0) return undefined
    const withProgress = seasons.find(
      (s) => s.userData?.playbackPositionTicks && s.userData.playbackPositionTicks > 0,
    )
    if (withProgress) return withProgress.id
    return seasons[0]?.id
  }, [seasons])

  const [activeSeasonId, setActiveSeasonId] = useState<string | undefined>(undefined)
  useEffect(() => {
    setActiveSeasonId(defaultSeasonId)
  }, [defaultSeasonId])

  // 当前季的 episodes
  const episodesState = useAsync<QueryResult<BaseItemDto>>(
    async () => {
      if (!userId || !item || !activeSeasonId) return { items: [], totalRecordCount: 0 }
      if (type === 'Series') {
        return getEpisodes(userId, item.id, activeSeasonId)
      }
      if (type === 'Season' && item.seriesId) {
        return getEpisodes(userId, item.seriesId, item.id)
      }
      return { items: [], totalRecordCount: 0 }
    },
    [userId, item?.id, item?.seriesId, type, activeSeasonId],
  )

  // Season/Episode 的父 series
  const parentSeriesState = useAsync<BaseItemDto | undefined>(
    async () => {
      if (!userId || !item) return undefined
      if ((type === 'Season' || type === 'Episode') && item.seriesId) {
        return getItem(userId, item.seriesId)
      }
      return undefined
    },
    [userId, item?.id, item?.seriesId, type],
  )

  // Episode 同季其它集数
  const siblingEpisodesState = useAsync<QueryResult<BaseItemDto>>(
    async () => {
      if (!userId || !item) return { items: [], totalRecordCount: 0 }
      if (type === 'Episode' && item.seriesId) {
        return getEpisodes(userId, item.seriesId, item.seasonId)
      }
      return { items: [], totalRecordCount: 0 }
    },
    [userId, item?.id, item?.seriesId, item?.seasonId, type],
  )

  const siblings = siblingEpisodesState.data?.items || []
  const siblingIndex = siblings.findIndex((e) => e.id === item?.id)
  const prevEp = siblingIndex > 0 ? siblings[siblingIndex - 1] : undefined
  const nextEp =
    siblingIndex >= 0 && siblingIndex < siblings.length - 1 ? siblings[siblingIndex + 1] : undefined

  return {
    // seasons
    seasons,
    activeSeasonId,
    setActiveSeasonId,
    // episodes (current season)
    episodes: episodesState.data?.items || [],
    episodesLoading: episodesState.loading,
    episodesError: episodesState.error,
    // parent series
    series: parentSeriesState.data,
    // sibling episodes (for episode type)
    siblings,
    prevEp,
    nextEp,
  }
}
