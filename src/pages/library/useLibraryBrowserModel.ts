import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getGenres, getItems, getUserViews, type UserView } from '@/api'
import type { BaseItemDto } from '@/api/types'
import { useAsync } from '@/hooks/useAsync'
import type { LibraryFilterState } from '@/components/ui/LibraryFilterBar'

const PAGE_SIZE = 60

export interface UseLibraryBrowserModelParams {
  userId: string
  viewId: string
  filter: LibraryFilterState
}

export function useLibraryBrowserModel(params: UseLibraryBrowserModelParams) {
  const { userId, viewId, filter } = params
  const viewsState = useAsync<{ items: UserView[]; totalRecordCount: number }>(
    async () => (userId ? getUserViews(userId) : { items: [], totalRecordCount: 0 }),
    [userId],
  )
  const currentView = useMemo(
    () => viewsState.data?.items.find((view) => view.id === viewId),
    [viewsState.data, viewId],
  )
  const [genres, setGenres] = useState<{ name: string }[]>([])
  const [all, setAll] = useState<BaseItemDto[]>([])
  const [total, setTotal] = useState(0)
  const [startIndex, setStartIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [loadedEmpty, setLoadedEmpty] = useState(false)

  useEffect(() => {
    setAll([])
    setTotal(0)
    setStartIndex(0)
    setLoadedEmpty(false)
    setError(null)
  }, [
    viewId,
    filter.sortBy,
    filter.sortOrder,
    filter.genre,
    filter.yearFrom,
    filter.yearTo,
    filter.played,
    filter.searchTerm,
  ])

  useEffect(() => {
    if (!userId || !viewId) {
      setGenres([])
      return
    }
    let cancelled = false
    getGenres(userId, { parentId: viewId, limit: 100, recursive: true })
      .then((response) => {
        if (cancelled) return
        setGenres(response.items
          .map((item) => ({ name: item.name || '' }))
          .filter((genre) => genre.name))
      })
      .catch((e: unknown) => {
        console.error('[LibraryPage] getGenres failed:', e)
      })
    return () => {
      cancelled = true
    }
  }, [userId, viewId])

  const doLoad = useCallback(async () => {
    if (!userId || !viewId) return
    setLoading(true)
    try {
      const res = await getItems(userId, buildItemsParams({
        viewId,
        startIndex,
        filter,
        collectionType: currentView?.collectionType,
      }))
      setAll((prev) => [...prev, ...res.items])
      setTotal(res.totalRecordCount)
      if (res.items.length === 0 && startIndex === 0) setLoadedEmpty(true)
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e : new Error(String(e)))
      console.error('[LibraryPage] getItems failed:', e)
    } finally {
      setLoading(false)
    }
  }, [currentView?.collectionType, filter, startIndex, userId, viewId])

  useEffect(() => {
    void doLoad()
  }, [doLoad])

  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!sentinelRef.current) return
    const element = sentinelRef.current
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return
        if (loading) return
        if (all.length >= total && total > 0) return
        setStartIndex((index) => (index === 0 ? PAGE_SIZE : index + PAGE_SIZE))
      },
      { rootMargin: '300px 0px' },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [all.length, loading, total])

  const handleLoadMore = useCallback(() => {
    if (loading) return
    if (all.length >= total && total > 0) return
    setStartIndex((index) => (index === 0 ? PAGE_SIZE : index + PAGE_SIZE))
  }, [all.length, loading, total])

  const posterShape: 'poster' | 'backdrop' =
    currentView?.collectionType === 'musicvideos' ? 'backdrop' : 'poster'

  return {
    viewsState,
    currentView,
    genres,
    all,
    total,
    loading,
    error,
    loadedEmpty,
    sentinelRef,
    posterShape,
    doLoad,
    setError,
    handleLoadMore,
  }
}

function buildItemsParams(params: {
  viewId: string
  startIndex: number
  filter: LibraryFilterState
  collectionType?: string
}): Parameters<typeof getItems>[1] {
  const { viewId, startIndex, filter, collectionType } = params
  const requestParams: Parameters<typeof getItems>[1] = {
    parentId: viewId,
    startIndex,
    limit: PAGE_SIZE,
    enableImages: true,
    sortBy: filter.sortBy,
    sortOrder: filter.sortOrder,
  }
  if (filter.genre) requestParams.genres = filter.genre
  if (filter.searchTerm) requestParams.searchTerm = filter.searchTerm
  if (filter.played === 'played') requestParams.isPlayed = true
  else if (filter.played === 'unplayed') requestParams.isPlayed = false
  if (filter.yearFrom || filter.yearTo) {
    requestParams.years = buildYearList(filter)
  }
  requestParams.includeItemTypes = includeItemTypesForCollection(collectionType)
  return requestParams
}

function buildYearList(filter: LibraryFilterState): string {
  const years: string[] = []
  const from = filter.yearFrom ? Number(filter.yearFrom) : 1900
  const to = filter.yearTo ? Number(filter.yearTo) : new Date().getFullYear()
  for (let year = to; year >= from; year--) years.push(String(year))
  return years.join(',')
}

function includeItemTypesForCollection(collectionType: string | undefined): string | undefined {
  switch (collectionType) {
    case 'movies':
      return 'Movie,Trailer'
    case 'tvshows':
      return 'Series'
    case 'music':
      return 'MusicAlbum,MusicArtist,Audio'
    case 'boxsets':
      return 'BoxSet'
    case 'books':
      return 'Book'
    case 'photos':
      return 'PhotoAlbum,Photo'
    case 'playlists':
      return 'Playlist'
    default:
      return undefined
  }
}
