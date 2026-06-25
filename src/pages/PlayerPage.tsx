import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Player } from '@/components/player/Player'
import { useAuthStore } from '@/store/auth'
import { useSettingsStore } from '@/store/settings'
import { getItem, getEpisodes, markPlayed, markFavorite } from '@/api/library'
import { posterUrl, backdropUrl, thumbUrl } from '@/api/images'
import type { BaseItemDto } from '@/api/types'
import { cx } from '@/utils'
import { formatDurationShort, ticksToSeconds } from '@/utils/time'
import { buildDeviceProfile } from '@/api/playback'

// 防止 buildDeviceProfile 被 tree-shake 警告
void buildDeviceProfile

interface EpisodesState {
  loading: boolean
  items: BaseItemDto[]
}

export function PlayerPage() {
  const { itemId = '' } = useParams()
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.userId)

  // ===== settings：下一集倒计时 / 自动跳下一集（只读，不写入远程）=====
  const showNextEpisodeCountdown = useSettingsStore((s) => s.showNextEpisodeCountdown)
  const nextEpisodeCountdownThreshold = useSettingsStore((s) => s.nextEpisodeCountdownThreshold)
  const nextEpisodeCountdownSeconds = useSettingsStore((s) => s.nextEpisodeCountdownSeconds)
  const autoPlayNextEpisode = useSettingsStore((s) => s.autoPlayNextEpisode)

  const playerContainerRef = useRef<HTMLDivElement>(null)
  const playerBindRef = useRef<HTMLDivElement | null>(null)

  const [item, setItem] = useState<BaseItemDto | null>(null)
  const [itemLoading, setItemLoading] = useState(true)
  const [itemError, setItemError] = useState<string | null>(null)

  const [favorite, setFavorite] = useState<boolean>(false)
  const [played, setPlayed] = useState<boolean>(false)

  const [episodes, setEpisodes] = useState<EpisodesState>({ loading: false, items: [] })

  const [showExpand, setShowExpand] = useState(false)
  const shortOverview = useMemo(() => {
    const ov = item?.overview ?? ''
    if (ov.length <= 220) return ov
    return showExpand ? ov : `${ov.slice(0, 220).trimEnd()}…`
  }, [item, showExpand])

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

        // 如果是 Episode，加载当前季所有剧集
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

  /* ========== 下一集卡片（"即将播放"） ========== */
  const [beforeEnded, setBeforeEnded] = useState(false)
  const [nextEpisode, setNextEpisode] = useState<BaseItemDto | null>(null)
  const [countdown, setCountdown] = useState(nextEpisodeCountdownSeconds)
  const [autoplayCancelled, setAutoplayCancelled] = useState(false)
  const autoPlayedRef = useRef(false)
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 计算 next episode
  useEffect(() => {
    if (!item || !episodes.items.length) {
      setNextEpisode(null)
      return
    }
    const idx = episodes.items.findIndex((e) => e.id === item.id)
    if (idx < 0 || idx >= episodes.items.length - 1) {
      setNextEpisode(null)
      return
    }
    setNextEpisode(episodes.items[idx + 1])
  }, [item, episodes.items])

  // 清理倒计时
  const clearCountdown = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current)
      countdownTimerRef.current = null
    }
  }, [])

  const onBeforeEnded = useCallback(
    (_secondsLeft: number) => {
      if (!nextEpisode || beforeEnded || autoplayCancelled) return
      // 设置：关闭倒计时卡片，则直接跳过（仍然给 onEnded 处理「自动跳下一集」）
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
              navigate(`/player/${nextEpisode.id}`, { replace: false })
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
      navigate,
      showNextEpisodeCountdown,
      nextEpisodeCountdownSeconds,
      autoPlayNextEpisode,
    ],
  )

  const onEnded = useCallback(() => {
    // 如果倒计时还没到 0，且用户没取消，且开启了自动跳下一集 → 立即跳
    if (nextEpisode && !autoPlayedRef.current && !autoplayCancelled && autoPlayNextEpisode) {
      autoPlayedRef.current = true
      clearCountdown()
      navigate(`/player/${nextEpisode.id}`, { replace: false })
    }
  }, [nextEpisode, autoplayCancelled, clearCountdown, navigate, autoPlayNextEpisode])

  useEffect(() => () => clearCountdown(), [clearCountdown])

  /* ========== 绑定 Player 的 hasPrev/hasNext/onPrev/onNext ========== */
  // 剧集在列表中的前后位置
  const adjacency = useMemo(() => {
    if (!item || !episodes.items.length) return { prev: null as BaseItemDto | null, next: nextEpisode }
    const idx = episodes.items.findIndex((e) => e.id === item.id)
    return {
      prev: idx > 0 ? episodes.items[idx - 1] : null,
      next: nextEpisode,
    }
  }, [item, episodes.items, nextEpisode])

  useEffect(() => {
    const container = playerContainerRef.current
    const playerEl = container?.querySelector('div.relative.aspect-video') as
      | (HTMLDivElement & {
          __playerBindHandlers?: (opt: {
            hasPrev?: boolean
            hasNext?: boolean
            onPrev?: () => void
            onNext?: () => void
          }) => void
        })
      | null
    if (!playerEl) return
    playerBindRef.current = playerEl
    const bind = () => {
      playerEl.__playerBindHandlers?.({
        hasPrev: !!adjacency.prev,
        hasNext: !!adjacency.next,
        onPrev: adjacency.prev ? () => navigate(`/player/${adjacency.prev!.id}`) : undefined,
        onNext: adjacency.next ? () => navigate(`/player/${adjacency.next!.id}`) : undefined,
      })
    }
    bind()
    // 监听 player-ready 事件（Player 内 dispatch）
    const onReady = () => bind()
    playerEl.addEventListener('player-ready', onReady as EventListener)
    return () => {
      playerEl.removeEventListener('player-ready', onReady as EventListener)
    }
  }, [adjacency.prev, adjacency.next, navigate])

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

  /* ========== 相邻集列表（当前集 ± 6） ========== */
  const adjacentEpisodes = useMemo(() => {
    if (!item || !episodes.items.length) return [] as BaseItemDto[]
    const idx = episodes.items.findIndex((e) => e.id === item.id)
    if (idx < 0) return []
    const from = Math.max(0, idx - 6)
    const to = Math.min(episodes.items.length, idx + 7)
    return episodes.items.slice(from, to)
  }, [item, episodes.items])

  /* ========== 渲染 ========== */
  if (itemError) {
    return (
      <div className="py-12 text-center text-jelly-muted">
        <div>加载失败：{itemError}</div>
        <button type="button" className="btn mt-4" onClick={() => window.history.back()}>
          返回
        </button>
      </div>
    )
  }

  const breadcrumb = (() => {
    if (itemLoading || !item) return <div className="skeleton h-5 w-48 rounded" />
    if (item.type === 'Episode') {
      return (
        <nav className="flex items-center gap-2 text-sm text-jelly-muted flex-wrap">
          {item.seriesName ? (
            <span className="text-white truncate">{item.seriesName}</span>
          ) : null}
          {item.seriesName ? <span className="opacity-40">/</span> : null}
          {item.parentIndexNumber != null ? (
            <span>Season {item.parentIndexNumber}</span>
          ) : item.seasonName ? (
            <span>{item.seasonName}</span>
          ) : null}
          {item.indexNumber != null && (item.parentIndexNumber != null || item.seasonName) ? (
            <span className="opacity-40">/</span>
          ) : null}
          {item.indexNumber != null ? (
            <span>E{String(item.indexNumber).padStart(2, '0')}</span>
          ) : null}
          {item.name ? <span className="opacity-40">·</span> : null}
          {item.name ? <span className="text-white truncate">{item.name}</span> : null}
        </nav>
      )
    }
    return <div className="text-white font-medium truncate">{item.name ?? '未命名'}</div>
  })()

  return (
    <div className="pb-12 space-y-6">
      {/* 顶部 TopBar */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="返回"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
          className="btn-ghost !p-2"
        >
          {/* ← */}
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">{breadcrumb}</div>
      </div>

      {/* Player + 下一集卡片 相对容器 */}
      <div ref={playerContainerRef} className="relative max-w-[1400px] mx-auto">
        <Player
          itemId={itemId}
          startPositionTicks={startPositionTicks}
          seriesId={item?.seriesId}
          beforeEndedThresholdSeconds={nextEpisodeCountdownThreshold}
          onBeforeEnded={onBeforeEnded}
          onEnded={onEnded}
        >
          {/* 下一集卡片覆盖层：相对外层容器定位 */}
          {beforeEnded && nextEpisode && !autoplayCancelled ? (
            <div
              role="dialog"
              aria-label="即将播放下一集"
              className="absolute z-30 bottom-24 right-4 sm:right-6 w-[280px] sm:w-[320px] rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 bg-jelly-card/95 backdrop-blur animate-[fadeIn_.25s_ease-out]"
              style={{ animation: 'fadeIn .25s ease-out' }}
            >
              <div className="relative aspect-video">
                <img
                  src={
                    thumbUrl(nextEpisode, { width: 640 }) ||
                    backdropUrl(nextEpisode as BaseItemDto, { width: 640 }) ||
                    posterUrl(nextEpisode as BaseItemDto, { width: 640 })
                  }
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    const t = e.currentTarget
                    t.style.display = 'none'
                  }}
                />
                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-jelly-card to-transparent pointer-events-none" />
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[11px] font-medium">
                  {countdown}s 后自动播放
                </div>
              </div>
              <div className="p-3 space-y-2">
                <div className="text-[11px] text-jelly-muted">
                  {nextEpisode.parentIndexNumber != null && nextEpisode.indexNumber != null
                    ? `S${String(nextEpisode.parentIndexNumber).padStart(2, '0')}E${String(nextEpisode.indexNumber).padStart(2, '0')}`
                    : ''}
                </div>
                <div className="text-white font-semibold text-sm line-clamp-1">
                  {nextEpisode.name ?? '下一集'}
                </div>
                <div className="text-xs text-jelly-muted line-clamp-2 leading-relaxed min-h-[2.5em]">
                  {nextEpisode.overview || '暂无简介'}
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    className="btn !py-1.5 text-xs flex-1"
                    onClick={() => {
                      autoPlayedRef.current = true
                      clearCountdown()
                      navigate(`/player/${nextEpisode.id}`)
                    }}
                  >
                    立即播放
                  </button>
                  <button
                    type="button"
                    className="btn-ghost !py-1.5 text-xs flex-1"
                    onClick={() => {
                      setAutoplayCancelled(true)
                      clearCountdown()
                      setBeforeEnded(false)
                    }}
                  >
                    取消
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </Player>
      </div>

      {/* 条目详情 */}
      <div className="max-w-[1400px] mx-auto space-y-5 px-1">
        {/* 标题 & 操作 */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-white truncate">
              {itemLoading ? <span className="skeleton inline-block h-7 w-64 align-middle rounded" /> : (item?.name ?? '未命名')}
            </h1>
            {/* chip 元数据 */}
            <div className="flex flex-wrap gap-2">
              {itemLoading ? (
                <>
                  <span className="chip skeleton h-5 w-14 rounded" />
                  <span className="chip skeleton h-5 w-16 rounded" />
                  <span className="chip skeleton h-5 w-12 rounded" />
                </>
              ) : (
                <>
                  {item?.productionYear ? <span className="chip">{item.productionYear}</span> : null}
                  {item?.runTimeTicks ? (
                    <span className="chip">{formatDurationShort(ticksToSeconds(item.runTimeTicks))}</span>
                  ) : null}
                  {item?.officialRating ? (
                    <span className="chip">{item.officialRating}</span>
                  ) : null}
                  {item?.genres?.slice(0, 3).map((g) => (
                    <span key={g} className="chip">
                      {g}
                    </span>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* 收藏 / 已看按钮 */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              className={cx(
                'btn-gap-2 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md transition',
                favorite
                  ? 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 ring-1 ring-amber-500/20'
                  : 'btn-ghost',
              )}
              onClick={toggleFavorite}
              aria-pressed={favorite}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill={favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <span className="text-sm font-medium">{favorite ? '已收藏' : '收藏'}</span>
            </button>
            <button
              type="button"
              className={cx(
                'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md transition',
                played
                  ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 ring-1 ring-emerald-500/20'
                  : 'btn-ghost',
              )}
              onClick={togglePlayed}
              aria-pressed={played}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill={played ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span className="text-sm font-medium">{played ? '已看完' : '标记已看'}</span>
            </button>
          </div>
        </div>

        {/* Overview */}
        <div>
          {itemLoading ? (
            <div className="space-y-2">
              <div className="skeleton h-4 w-full rounded" />
              <div className="skeleton h-4 w-11/12 rounded" />
              <div className="skeleton h-4 w-3/4 rounded" />
            </div>
          ) : (
            <p className="text-sm text-jelly-text/85 leading-relaxed whitespace-pre-wrap">
              {shortOverview || '暂无简介'}
              {item && (item.overview?.length ?? 0) > 220 ? (
                <button
                  type="button"
                  onClick={() => setShowExpand((v) => !v)}
                  className="ml-2 text-jelly-accent hover:underline text-xs align-middle"
                >
                  {showExpand ? '收起' : '展开'}
                </button>
              ) : null}
            </p>
          )}
        </div>

        {/* 相邻集 */}
        {item?.type === 'Episode' && (episodes.loading || adjacentEpisodes.length > 0) ? (
          <div>
            <h2 className="text-lg font-semibold text-white mb-3">
              {item.seasonName || (item.parentIndexNumber != null ? `Season ${item.parentIndexNumber}` : '本季剧集')}
            </h2>
            {episodes.loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="card">
                    <div className="aspect-video skeleton rounded-none" />
                    <div className="p-3 space-y-2">
                      <div className="skeleton h-4 w-1/3 rounded" />
                      <div className="skeleton h-4 w-full rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {adjacentEpisodes.map((ep) => {
                  const isCurrent = ep.id === item.id
                  return (
                    <button
                      key={ep.id}
                      type="button"
                      onClick={() => navigate(`/player/${ep.id}`)}
                      className={cx(
                        'card text-left group',
                        isCurrent ? 'ring-2 ring-jelly-accent' : '',
                      )}
                    >
                      <div className="aspect-video bg-jelly-hover overflow-hidden relative">
                        <img
                          src={
                            thumbUrl(ep, { width: 480 }) ||
                            backdropUrl(ep as BaseItemDto, { width: 480 }) ||
                            posterUrl(ep as BaseItemDto, { width: 480 })
                          }
                          alt=""
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                        {ep.indexNumber != null ? (
                          <span className="absolute top-1 left-1 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-black/70 text-white">
                            E{String(ep.indexNumber).padStart(2, '0')}
                          </span>
                        ) : null}
                      </div>
                      <div className="p-3 space-y-1">
                        <div className="text-sm font-medium text-white line-clamp-1">
                          {ep.name ?? `第 ${ep.indexNumber ?? '?'} 集`}
                        </div>
                        <div className="text-xs text-jelly-muted line-clamp-2 leading-snug min-h-[2.2em]">
                          {ep.overview || '暂无简介'}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
