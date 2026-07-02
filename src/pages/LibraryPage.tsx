import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { getUserViews, getItems, type UserView } from '@/api'
import type { BaseItemDto } from '@/api/types'
import { useAsync } from '@/hooks/useAsync'
import { PosterCard } from '@/components/ui/PosterCard'
import { LibraryFilterBar, DEFAULT_FILTER, type LibraryFilterState } from '@/components/ui/LibraryFilterBar'
import { ErrorState } from '@/components/ui/ErrorState'
import { ViewToggle, type ViewMode } from '@/components/ui/primitives'
import { collectionTypeLabel } from '@/components/layout/Sidebar'
import { cx } from '@/utils'
import './LibraryPage.scss'

const PAGE_SIZE = 60

/**
 * 媒体库页面：筛选器 + 无限滚动网格。
 */
export function LibraryPage() {
  const { viewId = '' } = useParams()
  const userId = useAuthStore((s) => s.userId)

  // 获取媒体库列表（找当前视图信息）
  const viewsState = useAsync<{ items: UserView[]; totalRecordCount: number }>(
    async () => (userId ? getUserViews(userId) : { items: [], totalRecordCount: 0 }),
    [userId],
  )

  const currentView = useMemo(
    () => viewsState.data?.items?.find((v) => v.id === viewId),
    [viewsState.data, viewId],
  )

  // 筛选
  const [filter, setFilter] = useState<LibraryFilterState>(DEFAULT_FILTER)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')

  // 数据
  const [all, setAll] = useState<BaseItemDto[]>([])
  const [total, setTotal] = useState(0)
  const [startIndex, setStartIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [loadedEmpty, setLoadedEmpty] = useState(false)

  // 当 viewId 或筛选变化：重置
  useEffect(() => {
    setAll([])
    setTotal(0)
    setStartIndex(0)
    setLoadedEmpty(false)
    setError(null)
  }, [viewId, filter.sortBy, filter.sortOrder, filter.genre, filter.yearFrom, filter.yearTo, filter.played, filter.searchTerm])

  // 加载数据
  const doLoad = useCallback(async () => {
    if (!userId || !viewId) return
    setLoading(true)
    try {
      const params: Parameters<typeof getItems>[1] = {
        parentId: viewId,
        startIndex,
        limit: PAGE_SIZE,
        enableImages: true,
        sortBy: filter.sortBy,
        sortOrder: filter.sortOrder,
      }
      if (filter.genre) params.genres = filter.genre
      if (filter.searchTerm) params.searchTerm = filter.searchTerm
      if (filter.played === 'played') params.isPlayed = true
      else if (filter.played === 'unplayed') params.isPlayed = false
      if (filter.yearFrom || filter.yearTo) {
        const years: string[] = []
        const yf = filter.yearFrom ? Number(filter.yearFrom) : 1900
        const yt = filter.yearTo ? Number(filter.yearTo) : new Date().getFullYear()
        for (let y = yt; y >= yf; y--) years.push(String(y))
        if (years.length) params.years = years.join(',')
      }
      // 根据 collectionType 决定 includeItemTypes 默认值
      const ct = currentView?.collectionType
      if (ct === 'movies') params.includeItemTypes = 'Movie,Trailer'
      else if (ct === 'tvshows') params.includeItemTypes = 'Series'
      else if (ct === 'music') params.includeItemTypes = 'MusicAlbum,MusicArtist,Audio'
      else if (ct === 'boxsets') params.includeItemTypes = 'BoxSet'
      else if (ct === 'books') params.includeItemTypes = 'Book'
      else if (ct === 'photos') params.includeItemTypes = 'PhotoAlbum,Photo'
      else if (ct === 'playlists') params.includeItemTypes = 'Playlist'

      const res = await getItems(userId, params)
      setAll((prev) => [...prev, ...(res.items || [])])
      setTotal(res.totalRecordCount ?? 0)
      if ((res.items || []).length === 0 && startIndex === 0) setLoadedEmpty(true)
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e : new Error(String(e)))
      console.error('[LibraryPage] getItems failed:', e)
    } finally {
      setLoading(false)
    }
  }, [userId, viewId, startIndex, filter, currentView?.collectionType])

  useEffect(() => {
    void doLoad()
  }, [doLoad])

  // 无限滚动：IntersectionObserver
  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!sentinelRef.current) return
    const el = sentinelRef.current
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return
        if (loading) return
        if (all.length >= total && total > 0) return
        setStartIndex((n) => (n === 0 ? PAGE_SIZE : n + PAGE_SIZE))
      },
      { rootMargin: '300px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [all.length, total, loading])

  // 根据媒体库类型决定卡片形状
  const posterShape: 'poster' | 'backdrop' =
    currentView?.collectionType === 'musicvideos' ? 'backdrop' : 'poster'

  const skeletonCount = 24

  function skeletonAspect() {
    // 避免 TS 对字面量类型作过度窄化
    if ((posterShape as string) === 'backdrop') return 'library-page__skeleton-poster is-backdrop skeleton'
    return 'library-page__skeleton-poster is-poster skeleton'
  }

  function handleLoadMore() {
    if (loading) return
    if (all.length >= total && total > 0) return
    setStartIndex((n) => (n === 0 ? PAGE_SIZE : n + PAGE_SIZE))
  }

  return (
    <div className="library-page">
      <header className="library-page__header">
        <div className="library-page__heading">
          <h1 className="library-page__title">
            {viewsState.loading ? (
              <span className="library-page__title-skeleton skeleton" />
            ) : (
              currentView?.name || '媒体库'
            )}
          </h1>
          <span className="chip library-page__type-count">
            {currentView?.collectionType
              ? collectionTypeLabel(currentView.collectionType) + ' · '
              : ''}
            共 {total > 0 ? total : loading ? '…' : all.length} 条
          </span>
        </div>
        <ViewToggle
          value={viewMode}
          onChange={setViewMode}
          className="library-page__view-toggle"
        />
      </header>

      <LibraryFilterBar viewId={viewId} value={filter} onChange={setFilter} />

      {error && (
        <ErrorState
          title="加载失败"
          message={error.message}
          onRetry={() => {
            setError(null)
            void doLoad()
          }}
        />
      )}

      {loading && all.length === 0 && !error && (
        <div className={cx('library-page__grid', viewMode === 'list' && 'is-list')}>
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <div key={i}>
              <div className={skeletonAspect()} />
              <div className="library-page__skeleton-line skeleton" />
              <div className="library-page__skeleton-line library-page__skeleton-line--short skeleton" />
            </div>
          ))}
        </div>
      )}

      {all.length > 0 && (
        <div className={cx('library-page__grid', viewMode === 'list' && 'is-list')}>
          {all.map((item) => (
            <PosterCard key={item.id} item={item} shape={posterShape} size="md" showPlayButton />
          ))}
        </div>
      )}

      {all.length > 0 && all.length < total && (
        <div ref={sentinelRef} className="library-page__load-more">
          {loading ? (
            <div className="library-page__loading">
              <span />
              加载中…
            </div>
          ) : (
            <button type="button" className="library-page__load-button" onClick={handleLoadMore}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
              加载更多
            </button>
          )}
        </div>
      )}

      {all.length > 0 && all.length >= total && total > 0 && (
        <div className="library-page__done">已加载全部内容</div>
      )}

      {!loading && loadedEmpty && total === 0 && !error && (
        <div className="library-page__empty">
          <div className="library-page__empty-icon" />
          <div className="library-page__empty-title">该媒体库内还没有内容</div>
          <div className="library-page__empty-text">尝试调整筛选条件或稍后再试</div>
        </div>
      )}
    </div>
  )
}
