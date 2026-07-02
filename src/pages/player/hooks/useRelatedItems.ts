import { useEffect, useState } from 'react'
import { getSimilarItems } from '@/api/library'
import type { BaseItemDto } from '@/api/types'

export interface RelatedItemsState {
  error: Error | null
  items: BaseItemDto[]
  loading: boolean
}

function supportsRelatedItems(item: BaseItemDto | null): item is BaseItemDto {
  return item?.type === 'Movie' ||
    item?.type === 'Trailer' ||
    item?.type === 'Video' ||
    item?.type === 'MusicVideo'
}

export function useRelatedItems({
  item,
  userId,
}: {
  item: BaseItemDto | null
  userId: string
}): RelatedItemsState {
  const [state, setState] = useState<RelatedItemsState>({
    error: null,
    items: [],
    loading: false,
  })

  useEffect(() => {
    if (!userId || !supportsRelatedItems(item)) {
      setState({ error: null, items: [], loading: false })
      return
    }
    let cancelled = false
    setState({ error: null, items: [], loading: true })
    void getSimilarItems(userId, item.id, { limit: 16 })
      .then((result) => {
        if (cancelled) return
        setState({ error: null, items: result.items, loading: false })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setState({
          error: error instanceof Error ? error : new Error(String(error)),
          items: [],
          loading: false,
        })
      })
    return () => {
      cancelled = true
    }
  }, [item, userId])

  return state
}
