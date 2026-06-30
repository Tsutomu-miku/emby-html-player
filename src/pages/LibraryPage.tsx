import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { getUserViews, getItems, type UserView } from '@/api'
import type { BaseItemDto } from '@/api/types'
import { useAsync } from '@/hooks/useAsync'
import { PosterCard } from '@/components/ui/PosterCard'
import { LibraryFilterBar, DEFAULT_FILTER, type LibraryFilterState } from '@/components/ui/LibraryFilterBar'
import { ErrorState } from '@/components/ui/ErrorState'
import { collectionTypeLabel } from '@/components/layout/Sidebar'

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
    if ((posterShape as string) === 'backdrop') return 'skeleton aspect-video rounded-lg'
    return 'skeleton aspect-[2/3] rounded-lg'
  }

  return (
    <div className="space-y-5">
      {/* 顶部：标题 + 面包屑文字 */}
      <header className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold">
            {viewsState.loading ? (
              <span className="inline-block w-48 h-8 skeleton rounded" />
            ) : (
              currentView?.name || '媒体库'
            )}
          </h1>
          {currentView?.collectionType && (
            <span className="chip">{collectionTypeLabel(currentView.collectionType)}</span>
          )}
        </div>
        <p className="text-sm text-jelly-muted">
          共 {total > 0 ? total : loading ? '...' : all.length} 条
        </p>
      </header>

      {/* 筛选器 */}
      <LibraryFilterBar viewId={viewId} value={filter} onChange={setFilter} />

      {/* 错误 */}
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

      {/* 加载中初始骨架 */}
      {loading && all.length === 0 && !error && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <div key={i}>
              <div className={skeletonAspect()} />
              <div className="mt-2 h-3 skeleton w-3/4 rounded" />
              <div className="mt-1 h-3 skeleton w-1/2 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* 网格 */}
      {all.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
          {all.map((item) => (
            <PosterCard key={item.id} item={item} shape={posterShape} size="md" showPlayButton />
          ))}
        </div>
      )}

      {/* 哨兵（触发加载更多） */}
      {all.length > 0 && all.length < total && (
        <div ref={sentinelRef} className="py-4 flex justify-center">
          {loading ? (
            <div className="inline-flex items-center gap-2 text-jelly-muted text-sm">
              <span className="w-4 h-4 border-2 border-jelly-muted border-t-transparent rounded-full animate-spin" />
              加载中…
            </div>
          ) : (
            <div className="text-jelly-muted text-sm">滚动加载更多</div>
          )}
        </div>
      )}

      {all.length > 0 && all.length >= total && total > 0 && (
        <div className="py-4 text-center text-sm text-jelly-muted">— 已加载全部内容 —</div>
      )}

      {/* 空态 */}
      {!loading && loadedEmpty && total === 0 && !error && (
        <div className="py-16 text-center">
          <div className="text-4xl mb-3">📭</div>
          <div className="text-lg text-jelly-text">该媒体库内还没有内容</div>
          <div className="text-sm text-jelly-muted mt-1">尝试调整筛选条件或稍后再试</div>
        </div>
      )}
    </div>
  )
}
