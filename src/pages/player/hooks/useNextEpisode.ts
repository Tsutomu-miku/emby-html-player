import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BaseItemDto } from '@/api/types'

export interface UseNextEpisodeSettings {
  showNextEpisodeCountdown: boolean
  nextEpisodeCountdownThreshold: number
  nextEpisodeCountdownSeconds: number
  autoPlayNextEpisode: boolean
}

export interface UseNextEpisodeProps {
  item: BaseItemDto | null
  episodes: BaseItemDto[]
  settings: UseNextEpisodeSettings
  onNavigate: (id: string) => void
}

export interface UseNextEpisodeReturn {
  nextEpisode: BaseItemDto | null
  countdown: number
  beforeEnded: boolean
  autoplayCancelled: boolean
  setAutoplayCancelled: (v: boolean) => void
  setBeforeEnded: (v: boolean) => void
  clearCountdown: () => void
  autoPlayedRef: React.MutableRefObject<boolean>
  onBeforeEndedHandler: (secondsLeft: number) => void
  onEndedHandler: () => void
}

export function useNextEpisode({ item, episodes, settings, onNavigate }: UseNextEpisodeProps): UseNextEpisodeReturn {
  const { showNextEpisodeCountdown, nextEpisodeCountdownSeconds, autoPlayNextEpisode } = settings

  const [beforeEnded, setBeforeEnded] = useState(false)
  const [nextEpisode, setNextEpisode] = useState<BaseItemDto | null>(null)
  const [countdown, setCountdown] = useState(nextEpisodeCountdownSeconds)
  const [autoplayCancelled, setAutoplayCancelled] = useState(false)
  const autoPlayedRef = useRef(false)
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 计算 next episode
  useEffect(() => {
    if (!item || !episodes.length) {
      setNextEpisode(null)
      return
    }
    const idx = episodes.findIndex((e) => e.id === item.id)
    if (idx < 0 || idx >= episodes.length - 1) {
      setNextEpisode(null)
      return
    }
    setNextEpisode(episodes[idx + 1])
  }, [item, episodes])

  // settings 改变时重置 countdown 初始值
  useEffect(() => {
    setCountdown(nextEpisodeCountdownSeconds)
  }, [nextEpisodeCountdownSeconds])

  // itemId 变化时重置 beforeEnded / autoplayCancelled
  useEffect(() => {
    setBeforeEnded(false)
    setAutoplayCancelled(false)
    autoPlayedRef.current = false
  }, [item?.id])

  // 清理倒计时
  const clearCountdown = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current)
      countdownTimerRef.current = null
    }
  }, [])

  const onBeforeEndedHandler = useCallback(
    (_secondsLeft: number) => {
      if (!nextEpisode || beforeEnded || autoplayCancelled) return
      if (!showNextEpisodeCountdown) return
      setBeforeEnded(true)
      setCountdown(Math.max(3, nextEpisodeCountdownSeconds))
      autoPlayedRef.current = false
      clearCountdown()
      countdownTimerRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearCountdown()
            if (!autoPlayedRef.current && !autoplayCancelled && autoPlayNextEpisode) {
              autoPlayedRef.current = true
              onNavigate(nextEpisode.id)
            }
            return 0
          }
          return c - 1
        })
      }, 1000)
    },
    [
      nextEpisode,
      beforeEnded,
      autoplayCancelled,
      clearCountdown,
      onNavigate,
      showNextEpisodeCountdown,
      nextEpisodeCountdownSeconds,
      autoPlayNextEpisode,
    ],
  )

  const onEndedHandler = useCallback(() => {
    if (nextEpisode && !autoPlayedRef.current && !autoplayCancelled && autoPlayNextEpisode) {
      autoPlayedRef.current = true
      clearCountdown()
      onNavigate(nextEpisode.id)
    }
  }, [nextEpisode, autoplayCancelled, clearCountdown, onNavigate, autoPlayNextEpisode])

  useEffect(() => () => clearCountdown(), [clearCountdown])

  return useMemo(
    () => ({
      nextEpisode,
      countdown,
      beforeEnded,
      autoplayCancelled,
      setAutoplayCancelled,
      setBeforeEnded,
      clearCountdown,
      autoPlayedRef,
      onBeforeEndedHandler,
      onEndedHandler,
    }),
    [
      nextEpisode,
      countdown,
      beforeEnded,
      autoplayCancelled,
      clearCountdown,
      onBeforeEndedHandler,
      onEndedHandler,
    ],
  )
}
