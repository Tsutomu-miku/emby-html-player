import { useMemo, useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import {
  getItem,
  getSeasons,
  getEpisodes,
  getSimilarItems,
  getItems,
  markFavorite,
  markPlayed,
} from '@/api/library'
import { getUserViews, type UserView } from '@/api'
import type { BaseItemDto, QueryResult } from '@/api/types'
import { useAsync } from '@/hooks/useAsync'
import { posterUrl, backdropUrl, logoUrl, thumbUrl } from '@/api/images'
import { ticksToSeconds, formatDurationShort, formatDate } from '@/utils/time'
import { cx } from '@/utils'
import { PosterCard } from '@/components/ui/PosterCard'
import { HorizontalRow } from '@/components/ui/HorizontalRow'
import { SeasonPicker } from '@/components/ui/SeasonPicker'
import { EpisodeRow } from '@/components/ui/EpisodeRow'
import { ErrorState } from '@/components/ui/ErrorState'
import { collectionTypeLabel } from '@/components/layout/Sidebar'

/** ItemDetailPage：根据 type 展示不同内容（Series/Season/Episode/Movie/...） */
export function ItemDetailPage() {
  const { itemId = '' } = useParams()
  const userId = useAuthStore((s) => s.userId)
  const navigate = useNavigate()

  // Toast state (for copy link)
  const [toast, setToast] = useState('')
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2000)
    return () => clearTimeout(t)
  }, [toast])

  // ============ 主 item ============
  const itemState = useAsync<BaseItemDto>(
    async () => (userId && itemId ? getItem(userId, itemId) : ({} as BaseItemDto)),
    [userId, itemId],
  )
  const item = itemState.data

  // 本地 state：收藏 & 已看（乐观更新）
  const [isFav, setIsFav] = useState<boolean | null>(null)
  const [isPlayed, setIsPlayed] = useState<boolean | null>(null)
  useEffect(() => {
    if (!item?.userData) return
    setIsFav(item.userData.isFavorite ?? false)
    setIsPlayed(item.userData.played ?? false)
  }, [item?.userData?.isFavorite, item?.userData?.played])

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
    } catch {
      setToast('复制失败')
    }
  }

  // ============ Series ============
  const type = item?.type

  const seasonsState = useAsync<QueryResult<BaseItemDto>>(
    async () =>
      userId && itemId && type === 'Series'
        ? getSeasons(userId, itemId)
        : { items: [], totalRecordCount: 0 },
    [userId, itemId, type],
  )

  // 根据 userData 确定默认选中的季（有播放进度的季优先，否则第一个季；否则最后一个季）
  const seasons = seasonsState.data?.items || []
  const defaultSeasonId = useMemo(() => {
    if (seasons.length === 0) return undefined
    // 找有 userData 播放进度的季
    const withProgress = seasons.find(
      (s) => s.userData?.playbackPositionTicks && s.userData.playbackPositionTicks > 0,
    )
    if (withProgress) return withProgress.id
    // 否则第一个（最早的季）
    return seasons[0]?.id
  }, [seasons])

  const [activeSeasonId, setActiveSeasonId] = useState<string | undefined>(undefined)
  useEffect(() => {
    setActiveSeasonId(defaultSeasonId)
  }, [defaultSeasonId])

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

  // ============ Season：父 series ============
  const parentSeriesState = useAsync<BaseItemDto>(
    async () => {
      if (!userId || !item) return {} as BaseItemDto
      if ((type === 'Season' || type === 'Episode') && item.seriesId) {
        return getItem(userId, item.seriesId)
      }
      return {} as BaseItemDto
    },
    [userId, item?.id, item?.seriesId, type],
  )

  // ============ Episode：同季 episodes（上/下一集） ============
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
  const nextEp = siblingIndex >= 0 && siblingIndex < siblings.length - 1 ? siblings[siblingIndex + 1] : undefined

  // ============ Similar Items (Movie / Trailer / Video) ============
  const similarState = useAsync<QueryResult<BaseItemDto>>(
    async () =>
      userId && itemId && (type === 'Movie' || type === 'Trailer' || type === 'Video' || type === 'MusicVideo')
        ? getSimilarItems(userId, itemId, { limit: 16 })
        : { items: [], totalRecordCount: 0 },
    [userId, itemId, type],
  )

  // ============ BoxSet / Folder：子项网格 ============
  const childrenState = useAsync<QueryResult<BaseItemDto>>(
    async () =>
      userId && itemId && (type === 'BoxSet' || type === 'Folder' || type === 'CollectionFolder' || type === 'AggregateFolder')
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
      <div className="space-y-6">
        <div className="rounded-2xl h-80 md:h-[420px] skeleton overflow-hidden" />
        <div className="mt-[-80px] relative px-4 flex gap-4 md:gap-6">
          <div className="w-48 md:w-56 shrink-0 hidden sm:block">
            <div className="aspect-[2/3] skeleton rounded-xl shadow-2xl" />
          </div>
          <div className="flex-1 min-w-0 space-y-3 pt-20">
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
  const logoSrc = logoUrl(item, { quality: 80 })

  // Chips
  const chips: React.ReactNode[] = []
  if (item.productionYear) chips.push(<span key="y" className="chip">{item.productionYear}</span>)
  if (item.runTimeTicks)
    chips.push(
      <span key="d" className="chip">
        {formatDurationShort(ticksToSeconds(item.runTimeTicks))}
      </span>,
    )
  const rating = item.communityRating
  if (rating)
    chips.push(
      <span key="r" className="chip">
        ⭐ {rating.toFixed(1)}
      </span>,
    )
  ;(item.genres || []).slice(0, 3).forEach((g) => chips.push(<span key={`g-${g}`} className="chip">{g}</span>))

  // Overview 展开状态
  const [overviewExpanded, setOverviewExpanded] = useState(false)

  // Hero title（Episode 显示系列名 + 本集标题）
  const heroTitle =
    type === 'Episode' && item.seriesName
      ? item.name || `第 ${item.indexNumber ?? 0} 集`
      : item.name || '未命名'

  const series = parentSeriesState.data

  return (
    <div className="space-y-6 relative">
      {/* Hero 区 */}
      <div className="relative rounded-2xl overflow-hidden">
        <div className="relative h-80 md:h-[420px] w-full">
          <img
            src={backdropSrc}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.onerror = null
              e.currentTarget.style.visibility = 'hidden'
            }}
          />
          {/* 渐变覆盖层 */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-jelly-bg" />
          <div className="absolute inset-0 bg-gradient-to-r from-jelly-bg/60 via-transparent to-transparent" />

          {/* 右下 logo/标题浮层 */}
          <div className="absolute bottom-4 left-4 right-4 md:bottom-8 md:left-8 md:right-8 md:pl-64 md:pl-72">
            {logoSrc ? (
              <img
                src={logoSrc}
                alt=""
                className="max-h-24 md:max-h-32 w-auto max-w-full object-contain drop-shadow-lg"
                onError={(e) => {
                  e.currentTarget.onerror = null
                  e.currentTarget.style.display = 'none'
                }}
              />
            ) : (
              <div>
                {type === 'Episode' && item.seriesName && (
                  <div className="text-sm md:text-base text-jelly-muted mb-1">
                    {item.seriesName}
                    {item.parentIndexNumber != null &&
                      ` · 第 ${item.parentIndexNumber} 季`}
                    {item.indexNumber != null &&
                      ` · 第 ${item.indexNumber} 集`}
                  </div>
                )}
                <h1 className="text-2xl md:text-4xl font-bold text-white drop-shadow-md">
                  {heroTitle}
                </h1>
              </div>
            )}
            {item.originalTitle && item.originalTitle !== item.name && (
              <div className="text-sm md:text-base text-jelly-muted mt-1 italic hidden sm:block">
                {item.originalTitle}
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">{chips}</div>
            {item.tagline && (
              <p className="mt-2 text-sm md:text-base italic text-jelly-muted line-clamp-2">
                {item.tagline}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 内容区 */}
      <div className="mt-[-80px] md:mt-[-96px] relative px-2 md:px-4 flex flex-col md:flex-row gap-4 md:gap-6">
        {/* 左侧海报 */}
        <div className="w-36 md:w-48 md:w-56 shrink-0 mx-auto md:mx-0">
          <img
            src={posterSrc}
            alt={item.name || ''}
            className="w-full aspect-[2/3] rounded-xl shadow-2xl object-cover border border-white/10"
            onError={(e) => {
              e.currentTarget.onerror = null
              e.currentTarget.src =
                "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='300'><rect width='200' height='300' fill='%2320232c'/></svg>"
            }}
          />
        </div>

        {/* 中间内容 */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* 按钮组 */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => navigate(`/player/${item.id}`)}
              className="btn"
              type="button"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <polygon points="6 4 20 12 6 20 6 4" />
              </svg>
              播放
            </button>
            <button
              onClick={toggleFav}
              className={cx('btn-ghost', isFav && '!text-red-400 !bg-red-500/10')}
              type="button"
              aria-label={isFav ? '取消收藏' : '收藏'}
            >
              <svg
                viewBox="0 0 24 24"
                fill={isFav ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              {isFav ? '已收藏' : '收藏'}
            </button>
            <button
              onClick={togglePlayed}
              className="btn-ghost"
              type="button"
              aria-label={isPlayed ? '标记未看' : '标记已看'}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {isPlayed ? '已看' : '标记已看'}
            </button>
            <button onClick={copyLink} className="btn-ghost" type="button">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4"
              >
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              复制链接
            </button>
          </div>

          {/* Episode：关联信息 */}
          {type === 'Episode' && series?.name && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-jelly-muted">
              <span>本集属于</span>
              <Link to={`/item/${series.id}`} className="text-jelly-accent hover:underline">
                {series.name}
              </Link>
              {item.parentIndexNumber != null && (
                <span>· 第 {item.parentIndexNumber} 季</span>
              )}
            </div>
          )}
          {type === 'Season' && series?.name && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-jelly-muted">
              <span>属于系列</span>
              <Link to={`/item/${series.id}`} className="text-jelly-accent hover:underline">
                {series.name}
              </Link>
            </div>
          )}

          {/* Overview */}
          {item.overview && (
            <div>
              <h3 className="text-sm font-semibold text-jelly-muted uppercase tracking-wide mb-2">
                简介
              </h3>
              <p
                className={cx(
                  'text-sm md:text-base text-jelly-text leading-relaxed whitespace-pre-wrap',
                  !overviewExpanded && 'line-clamp-4',
                )}
                style={
                  !overviewExpanded
                    ? {
                        display: '-webkit-box',
                        WebkitLineClamp: 4,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }
                    : undefined
                }
              >
                {item.overview}
              </p>
              {item.overview.length > 120 && (
                <button
                  onClick={() => setOverviewExpanded((v) => !v)}
                  className="mt-1 text-sm text-jelly-accent hover:underline"
                  type="button"
                >
                  {overviewExpanded ? '收起' : '展开'}
                </button>
              )}
            </div>
          )}

          {/* Episode 上/下一集 */}
          {type === 'Episode' && siblings.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {prevEp && (
                <button
                  onClick={() => navigate(`/item/${prevEp.id}`)}
                  className="btn-ghost text-sm"
                  type="button"
                >
                  ← 上一集
                  {prevEp.indexNumber != null && ` (E${prevEp.indexNumber})`}
                </button>
              )}
              {nextEp && (
                <button
                  onClick={() => navigate(`/item/${nextEp.id}`)}
                  className="btn-ghost text-sm"
                  type="button"
                >
                  下一集
                  {nextEp.indexNumber != null && ` (E${nextEp.indexNumber})`} →
                </button>
              )}
            </div>
          )}

          {/* 演职员 */}
          {item.people && item.people.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-jelly-muted uppercase tracking-wide mb-3">
                演职员
              </h3>
              <div className="flex gap-3 md:gap-4 overflow-x-auto pb-2 -mx-1 px-1">
                {item.people.slice(0, 18).map((p, i) => (
                  <div key={`${p.id || p.name}-${i}`} className="shrink-0 w-20 md:w-24 text-center">
                    <div className="aspect-square rounded-lg overflow-hidden bg-jelly-card mb-1.5">
                      {p.primaryImageTag && p.id ? (
                        <img
                          src={posterUrl(
                            { id: p.id, imageTags: { Primary: p.primaryImageTag } },
                            { quality: 60, placeholderOnMissing: true },
                          )}
                          alt={p.name}
                          loading="lazy"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.onerror = null
                            e.currentTarget.style.visibility = 'hidden'
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-jelly-muted text-lg font-medium">
                          {(p.name || '?').slice(0, 1)}
                        </div>
                      )}
                    </div>
                    <div className="text-xs font-medium text-jelly-text truncate" title={p.name}>
                      {p.name}
                    </div>
                    <div className="text-[10px] text-jelly-muted truncate" title={p.role}>
                      {p.role || p.type || ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ======== 按类型差异的区块 ======== */}

      {/* Series：季选择器 + 剧集列表 */}
      {type === 'Series' && seasons.length > 0 && (
        <section className="space-y-4 pt-4">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-lg font-semibold">剧集</h2>
          </div>
          <SeasonPicker
            seasons={seasons}
            activeId={activeSeasonId}
            onChange={setActiveSeasonId}
          />
          <EpisodeList
            loading={episodesState.loading}
            items={episodesState.data?.items || []}
            error={episodesState.error}
          />
        </section>
      )}

      {/* Season：季选择器 + 剧集列表 */}
      {type === 'Season' && (
        <section className="space-y-4 pt-4">
          <h2 className="text-lg font-semibold">本季剧集</h2>
          <EpisodeList
            loading={episodesState.loading}
            items={episodesState.data?.items || []}
            error={episodesState.error}
          />
        </section>
      )}

      {/* Episode：同季其它集数提示 */}
      {type === 'Episode' && siblings.length > 1 && (
        <section className="space-y-3 pt-4">
          <h2 className="text-lg font-semibold">本季其它集数</h2>
          <div className="space-y-2">
            {siblings
              .filter((e) => e.id !== item.id)
              .slice(0, 12)
              .map((ep) => (
                <EpisodeRow key={ep.id} episode={ep} showSeasonLabel={false} />
              ))}
          </div>
        </section>
      )}

      {/* Movie / Trailer / Video / MusicVideo：相似内容 */}
      {(type === 'Movie' ||
        type === 'Trailer' ||
        type === 'Video' ||
        type === 'MusicVideo') && (
        <section className="pt-4">
          <HorizontalRow
            title="相似内容"
            items={similarState.data?.items || []}
            loading={similarState.loading}
            shape="poster"
            size="md"
          />
        </section>
      )}

      {/* BoxSet / Folder：子项网格 */}
      {(type === 'BoxSet' ||
        type === 'Folder' ||
        type === 'CollectionFolder' ||
        type === 'AggregateFolder') && (
        <section className="space-y-3 pt-4">
          <h2 className="text-lg font-semibold">
            {type === 'BoxSet' ? '合集内容' : '目录内容'}
          </h2>
          {childrenState.loading && childrenState.data?.items?.length === 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
              {Array.from({ length: 18 }).map((_, i) => (
                <div key={i} className="aspect-[2/3] skeleton rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
              {(childrenState.data?.items || []).map((child) => (
                <PosterCard key={child.id} item={child} size="md" shape="poster" showPlayButton />
              ))}
            </div>
          )}
          {childrenState.error && (
            <ErrorState
              title="加载子项失败"
              message={childrenState.error.message}
            />
          )}
          {!childrenState.loading &&
            (childrenState.data?.items?.length ?? 0) === 0 &&
            !childrenState.error && (
              <div className="py-10 text-center text-jelly-muted text-sm">暂无内容</div>
            )}
        </section>
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

/** 剧集列表：loading skeleton + EpisodeRow + error */
function EpisodeList({
  loading,
  items,
  error,
}: {
  loading: boolean
  items: BaseItemDto[]
  error?: Error
}) {
  if (error && items.length === 0) {
    return (
      <ErrorState title="加载剧集失败" message={error.message} className="max-w-2xl mx-auto" />
    )
  }
  if (loading && items.length === 0) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-[110px_1fr] sm:grid-cols-[160px_1fr] gap-3 sm:gap-4 p-2 sm:p-3"
          >
            <div className="aspect-video skeleton rounded" />
            <div className="space-y-2">
              <div className="h-4 skeleton w-2/5 rounded" />
              <div className="h-3 skeleton w-1/5 rounded" />
              <div className="h-3 skeleton w-full rounded" />
              <div className="h-3 skeleton w-5/6 rounded" />
            </div>
          </div>
        ))}
      </div>
    )
  }
  if (items.length === 0) {
    return <div className="py-10 text-center text-jelly-muted text-sm">暂无剧集</div>
  }
  return (
    <div className="space-y-2">
      {items.map((ep) => (
        <EpisodeRow key={ep.id} episode={ep} />
      ))}
    </div>
  )
}

// 防止 collectionTypeLabel 未使用的警告（LibraryFilterBar 中用视图 collectionType 过滤类型）
export { collectionTypeLabel, thumbUrl }
