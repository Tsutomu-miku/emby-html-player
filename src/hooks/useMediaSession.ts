import { useEffect, useRef } from 'react'
import { posterUrl } from '@/api/images'
import type { BaseItemDto } from '@/api/types'

export interface UseMediaSessionParams {
  item?: Pick<BaseItemDto, 'id' | 'name' | 'seriesName' | 'seasonName' | 'imageTags'> | null
  video: HTMLVideoElement | null
  hasPrev?: boolean
  hasNext?: boolean
  onPrev?: () => void
  onNext?: () => void
}

/**
 * 为 PWA / 原生锁屏、媒体控件提供元数据与动作回调（Media Session API）。
 */
export function useMediaSession(params: UseMediaSessionParams) {
  const { item, video, hasPrev, hasNext, onPrev, onNext } = params
  const paramsRef = useRef(params)
  paramsRef.current = params

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return
    const ms = navigator.mediaSession

    // 设置 meta
    if (item) {
      const artwork: MediaImage[] = []
      const p = posterUrl(item, { maxWidth: 512, maxHeight: 512 })
      if (p) artwork.push({ src: p, sizes: '512x512', type: 'image/jpeg' })
      try {
        ms.metadata = new MediaMetadata({
          title: item.name ?? '',
          artist: item.seriesName ?? '',
          album: item.seasonName ?? '',
          artwork,
        })
      } catch {
        /* ignore */
      }
    }

    const setPlaybackState = () => {
      if (!video) return
      try {
        ms.playbackState = video.paused ? 'paused' : 'playing'
      } catch {
        /* ignore */
      }
    }

    const handlers: [MediaSessionAction, MediaSessionActionHandler?][] = [
      [
        'play',
        () => {
          if (video) {
            void video.play().catch((err: unknown) => {
              console.warn('[Player] media session play failed', err)
            })
          }
        },
      ],
      [
        'pause',
        () => {
          if (video) video.pause()
        },
      ],
      [
        'seekbackward',
        (details) => {
          if (!video) return
          const delta = details.seekOffset ?? 10
          video.currentTime = Math.max(0, video.currentTime - delta)
        },
      ],
      [
        'seekforward',
        (details) => {
          if (!video) return
          const delta = details.seekOffset ?? 10
          video.currentTime = Math.min(video.duration || Infinity, video.currentTime + delta)
        },
      ],
      [
        'seekto',
        (details) => {
          if (!video || details.seekTime === null || details.seekTime === undefined) return
          video.currentTime = Math.min(video.duration || Infinity, Math.max(0, details.seekTime))
        },
      ],
      [
        'previoustrack',
        () => {
          const cur = paramsRef.current
          if (cur.hasPrev) cur.onPrev?.()
        },
      ],
      [
        'nexttrack',
        () => {
          const cur = paramsRef.current
          if (cur.hasNext) cur.onNext?.()
        },
      ],
    ]

    for (const [action, handler] of handlers) {
      try {
        ms.setActionHandler(action, handler ?? null)
      } catch {
        /* ignore: 某些浏览器不支持所有 action */
      }
    }

    if (!hasPrev) {
      try {
        ms.setActionHandler('previoustrack', null)
      } catch {
        /* ignore */
      }
    }
    if (!hasNext) {
      try {
        ms.setActionHandler('nexttrack', null)
      } catch {
        /* ignore */
      }
    }

    const onState = () => setPlaybackState()
    video?.addEventListener('play', onState)
    video?.addEventListener('pause', onState)
    setPlaybackState()

    return () => {
      video?.removeEventListener('play', onState)
      video?.removeEventListener('pause', onState)
      // 清理 action handlers
      for (const [action] of handlers) {
        try {
          ms.setActionHandler(action, null)
        } catch {
          /* ignore */
        }
      }
    }
  }, [item, video, hasPrev, hasNext, onPrev, onNext])
}
