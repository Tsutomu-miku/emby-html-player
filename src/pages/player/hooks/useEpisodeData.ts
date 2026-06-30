import { useCallback, useEffect, useMemo, useState } from 'react'
import { getItem, getEpisodes, markPlayed, markFavorite } from '@/api/library'
import type { BaseItemDto } from '@/api/types'
import { ticksToSeconds } from '@/utils/time'

export interface EpisodesState {
  loading: boolean
  items: BaseItemDto[]
}

export interface UseEpisodeDataProps {
  itemId: string
  userId: string
}

export interface UseEpisodeDataReturn {
  item: BaseItemDto | null
  itemLoading: boolean
  itemError: string | null
  episodes: EpisodesState
  favorite: boolean
  played: boolean
  startPositionTicks: number
  toggleFavorite: () => Promise<void>
  togglePlayed: () => Promise<void>
}

export function useEpisodeData({ itemId, userId }: UseEpisodeDataProps): UseEpisodeDataReturn {
  const [item, setItem] = useState<BaseItemDto | null>(null)
  const [itemLoading, setItemLoading] = useState(true)
  const [itemError, setItemError] = useState<string | null>(null)
  const [favorite, setFavorite] = useState(false)
  const [played, setPlayed] = useState(false)
  const [episodes, setEpisodes] = useState<EpisodesState>({ loading: false, items: [] })

  /* ========== 加载条目详情 + 剧集列表 ========== */
  useEffect(() => {
    if (!itemId || !userId) return
    let cancelled = false
    setItemLoading(true)
    setItemError(null)
    void (async () => {
      try {
        const it = await getItem(userId, itemId)
        if (cancelled) return
        setItem(it)
        setFavorite(!!it.userData?.isFavorite)
        setPlayed(!!it.userData?.played)

        if (it.type === 'Episode' && it.seriesId) {
          setEpisodes({ loading: true, items: [] })
          try {
            const seasonId = it.seasonId
            const res = await getEpisodes(userId, it.seriesId, seasonId)
            if (!cancelled) setEpisodes({ loading: false, items: res.items ?? [] })
          } catch {
            if (!cancelled) setEpisodes({ loading: false, items: [] })
          }
        } else {
          setEpisodes({ loading: false, items: [] })
        }
      } catch (err) {
        if (!cancelled) setItemError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!cancelled) setItemLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [itemId, userId])

  // startPositionTicks：用户上次位置（若 > 60 秒则继续）
  const startPositionTicks = useMemo(() => {
    const t = item?.userData?.playbackPositionTicks ?? 0
    if (ticksToSeconds(t) > 60) return t
    return 0
  }, [item])

  /* ========== 操作：收藏 / 已看 ========== */
  const toggleFavorite = useCallback(async () => {
    if (!userId || !item) return
    const next = !favorite
    setFavorite(next)
    try {
      await markFavorite(userId, item.id, next)
    } catch {
      setFavorite(!next)
    }
  }, [userId, item, favorite])

  const togglePlayed = useCallback(async () => {
    if (!userId || !item) return
    const next = !played
    setPlayed(next)
    try {
      await markPlayed(userId, item.id, next)
    } catch {
      setPlayed(!next)
    }
  }, [userId, item, played])

  return {
    item,
    itemLoading,
    itemError,
    episodes,
    favorite,
    played,
    startPositionTicks,
    toggleFavorite,
    togglePlayed,
  }
}
