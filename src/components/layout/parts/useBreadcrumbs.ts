import { useMemo } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/auth'
import { getUserViews, getItem, type UserView } from '@/api'
import type { BaseItemDto } from '@/api/types'

export interface BreadcrumbItem {
  label: string
  to?: string
}

/**
 * Hook: derives breadcrumb items from the current path, lazy-loading item
 * names for /item/:id and /player/:id routes.
 */
export function useBreadcrumbs(): BreadcrumbItem[] {
  const location = useLocation()
  const params = useParams()
  const userId = useAuthStore((s) => s.userId)
  const [views, setViews] = useState<UserView[]>([])
  const [itemName, setItemName] = useState<string>('')

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    getUserViews(userId)
      .then((r) => {
        if (!cancelled) setViews(r.items || [])
      })
      .catch((e: unknown) => console.error('[useBreadcrumbs] getUserViews failed:', e))
    return () => {
      cancelled = true
    }
  }, [userId])

  const needsItemName =
    location.pathname.startsWith('/item/') ||
    location.pathname.startsWith('/player/')
  useEffect(() => {
    if (!params.itemId || !userId || !needsItemName) {
      setItemName('')
      return
    }
    let cancelled = false
    getItem(userId, params.itemId, { fields: 'BaseItemName' })
      .then((it: BaseItemDto) => {
        if (!cancelled) setItemName(it.name || '')
      })
      .catch((e: unknown) => console.error('[useBreadcrumbs] getItem failed:', e))
    return () => {
      cancelled = true
    }
  }, [params.itemId, userId, needsItemName])

  return useMemo<BreadcrumbItem[]>(() => {
    const result: BreadcrumbItem[] = [{ label: '首页', to: '/' }]
    if (location.pathname.startsWith('/library/')) {
      const id = location.pathname.slice('/library/'.length).split('/')[0]
      const v = views.find((x) => x.id === id)
      result.push({ label: v?.name || '媒体库', to: `/library/${id}` })
    } else if (location.pathname.startsWith('/item/')) {
      result.push({ label: itemName || '详情' })
    } else if (location.pathname.startsWith('/player/')) {
      result.push({ label: '播放中' })
      if (itemName) result.push({ label: itemName })
    }
    return result
  }, [location.pathname, views, itemName])
}

/** Thin wrapper around useNavigate for back/forward controls — avoids
 *  repeating the void-callback pattern across call sites. */
export function useNavControls() {
  const navigate = useNavigate()
  return useMemo(
    () => ({
      back: () => {
        void navigate(-1)
      },
      forward: () => {
        void navigate(1)
      },
      refresh: () => {
        void navigate(0)
      },
    }),
    [navigate],
  )
}
