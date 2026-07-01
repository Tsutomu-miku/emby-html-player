import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import {
  getItem,
  getSimilarItems,
  getItems,
  markFavorite,
  markPlayed,
} from '@/api/library'
import { getUserViews } from '@/api'
import type { BaseItemDto, QueryResult } from '@/api/types'
import { useAsync } from '@/hooks/useAsync'
import { posterUrl, backdropUrl, thumbUrl } from '@/api/images'
import { ErrorState } from '@/components/ui/ErrorState'
import { collectionTypeLabel } from '@/components/layout/Sidebar'
import { useEpisodeData } from './item-detail/useEpisodeData'
import { HeroSection } from './item-detail/HeroSection'
import { InfoPanel } from './item-detail/InfoPanel'
import { CastList } from './item-detail/CastList'
import { SeasonEpisodePanel } from './item-detail/SeasonEpisodePanel'
import { SimilarSection } from './item-detail/SimilarSection'
import { ChildrenGrid } from './item-detail/ChildrenGrid'
import './ItemDetailPage.scss'

// 为未来引用预留（LibraryFilterBar 中按视图 collectionType 过滤类型）
void getUserViews

/** ItemDetailPage：根据 type 展示不同内容（Series/Season/Episode/Movie/...） */
export function ItemDetailPage() {
  const { itemId = '' } = useParams()
  const userId = useAuthStore((s) => s.userId)
  const navigate = useNavigate()

  // Toast state (for copy link, action errors)
  const [toast, setToast] = useState('')
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2000)
    return () => clearTimeout(t)
  }, [toast])

  // ============ 主 item ============
  const itemState = useAsync<BaseItemDto | undefined>(
    async () => (userId && itemId ? getItem(userId, itemId) : undefined),
    [userId, itemId],
  )
  const item = itemState.data
  const type = item?.type

  // ============ 收藏 & 已看（乐观更新） ============
  const [isFav, setIsFav] = useState<boolean | null>(null)
  const [isPlayed, setIsPlayed] = useState<boolean | null>(null)
  const [overviewExpanded, setOverviewExpanded] = useState(false)
  const itemUserData = item?.userData
  useEffect(() => {
    if (!itemUserData) return
    setIsFav(itemUserData.isFavorite ?? false)
    setIsPlayed(itemUserData.played ?? false)
  }, [itemUserData])

  async function toggleFav() {
    if (!userId || !itemId) return
    const next = !isFav
    setIsFav(next)
    try {
      await markFavorite(userId, itemId, next)
    } catch (e) {
      console.error('[markFavorite] failed:', e)
      setIsFav(!next)
      setToast('操作失败')
    }
  }

  async function togglePlayed() {
    if (!userId || !itemId) return
    const next = !isPlayed
    setIsPlayed(next)
    try {
      await markPlayed(userId, itemId, next)
    } catch (e) {
      console.error('[markPlayed] failed:', e)
      setIsPlayed(!next)
      setToast('操作失败')
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setToast('链接已复制')
    } catch (e) {
      console.error('[copyLink] failed:', e)
      setToast('复制失败')
    }
  }

  // ============ 季 / 剧集 / series 父级 / 同季（hook 统一管理） ============
  const ep = useEpisodeData(userId, item, type)

  // ============ Similar Items (Movie / Trailer / Video) ============
  const similarState = useAsync<QueryResult<BaseItemDto>>(
    async () =>
      userId &&
      itemId &&
      (type === 'Movie' ||
        type === 'Trailer' ||
        type === 'Video' ||
        type === 'MusicVideo')
        ? getSimilarItems(userId, itemId, { limit: 16 })
        : { items: [], totalRecordCount: 0 },
    [userId, itemId, type],
  )

  // ============ BoxSet / Folder：子项网格 ============
  const childrenState = useAsync<QueryResult<BaseItemDto>>(
    async () =>
      userId &&
      itemId &&
      (type === 'BoxSet' ||
        type === 'Folder' ||
        type === 'CollectionFolder' ||
        type === 'AggregateFolder')
        ? getItems(userId, { parentId: itemId, limit: 100, enableImages: true })
        : { items: [], totalRecordCount: 0 },
    [userId, itemId, type],
  )

  // ============ Error ============
  if (itemState.error && !item) {
    return (
      <ErrorState
        title="加载失败"
        message={itemState.error.message}
        onRetry={() => window.location.reload()}
      />
    )
  }

  // ============ Loading skeleton ============
  if (itemState.loading || !item) {
    return (
      <div className="item-detail-page">
        <div className="item-detail-hero skeleton" />
        <div className="item-detail-info">
          <div className="item-detail-info__poster">
            <div className="item-detail-info__poster-box skeleton" />
          </div>
          <div className="item-detail-info__content item-detail-info__content--loading">
            <div className="h-8 skeleton w-1/2" />
            <div className="h-4 skeleton w-1/3" />
            <div className="h-4 skeleton" />
            <div className="h-4 skeleton w-5/6" />
            <div className="mt-4 flex gap-3">
              <div className="h-10 w-24 skeleton rounded" />
              <div className="h-10 w-20 skeleton rounded" />
              <div className="h-10 w-20 skeleton rounded" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ============ Render ============
  const backdropSrc = backdropUrl(item, { quality: 80, placeholderOnMissing: true })
  const posterSrc = posterUrl(item, { quality: 80, placeholderOnMissing: true })
  const isVideoLikeItem =
    type === 'Movie' ||
    type === 'Trailer' ||
    type === 'Video' ||
    type === 'MusicVideo'

  return (
    <div className="item-detail-page">
      <HeroSection backdropSrc={backdropSrc} />

      <InfoPanel
        item={item}
        posterSrc={posterSrc}
        series={ep.series}
        prevEp={ep.prevEp}
        nextEp={ep.nextEp}
        isFav={isFav}
        isPlayed={isPlayed}
        onPlay={() => void navigate(`/player/${item.id}`)}
        onToggleFav={() => void toggleFav()}
        onTogglePlayed={() => void togglePlayed()}
        onCopyLink={() => void copyLink()}
        onNavigateToEpisode={(id) => void navigate(`/item/${id}`)}
        overviewExpanded={overviewExpanded}
        onToggleOverview={() => setOverviewExpanded((v) => !v)}
      />

      {isVideoLikeItem && (
        <SimilarSection
          items={similarState.data ? similarState.data.items : []}
          loading={similarState.loading}
        />
      )}

      <SeasonEpisodePanel
        type={type}
        item={item}
        seasons={ep.seasons}
        activeSeasonId={ep.activeSeasonId}
        onSeasonChange={ep.setActiveSeasonId}
        episodes={ep.episodes}
        episodesLoading={ep.episodesLoading}
        episodesError={ep.episodesError}
        siblingEpisodes={ep.siblings}
      />

      {item.people && item.people.length > 0 && <CastList people={item.people} />}

      {(type === 'BoxSet' ||
        type === 'Folder' ||
        type === 'CollectionFolder' ||
        type === 'AggregateFolder') && (
        <ChildrenGrid
          type={type}
          items={childrenState.data?.items || []}
          loading={childrenState.loading}
          error={childrenState.error}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-jelly-accent text-white text-sm shadow-2xl animate-fadeIn">
          {toast}
        </div>
      )}
    </div>
  )
}

export { collectionTypeLabel, thumbUrl }
