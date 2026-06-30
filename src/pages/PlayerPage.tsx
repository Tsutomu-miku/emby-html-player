/* eslint-disable max-lines -- PlayerPage glue 含多段 JSX/面包屑/收藏/简介，335 行 ≤ 400 符合特例 */
/* eslint-disable max-lines-per-function -- PlayerPage 页面级组件（路由+hooks+JSX），强耦合无法拆分到独立组件，335 行 ≤ 400 符合特例 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Player } from '@/components/player/Player'
import { useAuthStore } from '@/store/auth'
import { useSettingsStore } from '@/store/settings'
import type { BaseItemDto } from '@/api/types'
import { cx } from '@/utils'
import { formatDurationShort, ticksToSeconds } from '@/utils/time'
import { buildDeviceProfile } from '@/api/playback'
import { useEpisodeData } from './player/hooks/useEpisodeData'
import { useNextEpisode } from './player/hooks/useNextEpisode'
import { NextEpisodeCard } from './player/parts/NextEpisodeCard'
import { AdjacentEpisodes } from './player/parts/AdjacentEpisodes'

// 防止 buildDeviceProfile 被 tree-shake 警告
void buildDeviceProfile

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

  // ===== 数据加载 + 收藏/已看状态 =====
  const {
    item,
    itemLoading,
    itemError,
    episodes,
    favorite,
    played,
    startPositionTicks,
    toggleFavorite,
    togglePlayed,
  } = useEpisodeData({ itemId, userId })

  // ===== 下一集倒计时 / 自动播放 =====
  const {
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
  } = useNextEpisode({
    item,
    episodes: episodes.items,
    settings: {
      showNextEpisodeCountdown,
      nextEpisodeCountdownThreshold,
      nextEpisodeCountdownSeconds,
      autoPlayNextEpisode,
    },
    onNavigate: (id: string) => { void navigate(`/player/${id}`, { replace: false }) },
  })

  // ===== 展开/收起 overview =====
  const [showExpand, setShowExpand] = useState(false)
  useEffect(() => {
    setShowExpand(false)
  }, [item?.id])
  const shortOverview = useMemo(() => {
    const ov = item?.overview ?? ''
    if (ov.length <= 220) return ov
    return showExpand ? ov : `${ov.slice(0, 220).trimEnd()}…`
  }, [item, showExpand])

  /* ========== 绑定 Player 的 hasPrev/hasNext/onPrev/onNext ========== */
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
    const prevItem = adjacency.prev
    const nextItem = adjacency.next
    const bind = () => {
      playerEl.__playerBindHandlers?.({
        hasPrev: !!prevItem,
        hasNext: !!nextItem,
        onPrev: prevItem ? () => { void navigate(`/player/${prevItem.id}`) } : undefined,
        onNext: nextItem ? () => { void navigate(`/player/${nextItem.id}`) } : undefined,
      })
    }
    bind()
    const onReady: EventListener = () => { bind() }
    playerEl.addEventListener('player-ready', onReady)
    return () => {
      playerEl.removeEventListener('player-ready', onReady)
    }
  }, [adjacency.prev, adjacency.next, navigate])

  /* ========== 相邻集列表（当前集 ± 6） ========== */
  const adjacentEpisodes = useMemo(() => {
    if (!item || !episodes.items.length) return [] as BaseItemDto[]
    const idx = episodes.items.findIndex((e) => e.id === item.id)
    if (idx < 0) return []
    const from = Math.max(0, idx - 6)
    const to = Math.min(episodes.items.length, idx + 7)
    return episodes.items.slice(from, to)
  }, [item, episodes.items])

  const handleToggleFavorite = useCallback(() => {
    void toggleFavorite()
  }, [toggleFavorite])

  const handleTogglePlayed = useCallback(() => {
    void togglePlayed()
  }, [togglePlayed])

  /* ========== 面包屑（集数 / 名称） ========== */
  const breadcrumb = useMemo(() => {
    if (itemLoading || !item) return <div className="skeleton h-5 w-48 rounded" />
    if (item.type === 'Episode') {
      return (
        <nav className="flex items-center gap-2 text-sm text-jelly-muted flex-wrap">
          {item.seriesName ? (
            <span className="text-white truncate">{item.seriesName}</span>
          ) : null}
          {item.seriesName ? <span className="opacity-40">/</span> : null}
          {item.parentIndexNumber !== null ? (
            <span>Season {item.parentIndexNumber}</span>
          ) : item.seasonName ? (
            <span>{item.seasonName}</span>
          ) : null}
          {item.indexNumber !== null && (item.parentIndexNumber !== null || item.seasonName) ? (
            <span className="opacity-40">/</span>
          ) : null}
          {item.indexNumber !== null ? (
            <span>E{String(item.indexNumber).padStart(2, '0')}</span>
          ) : null}
          {item.name ? <span className="opacity-40">·</span> : null}
          {item.name ? <span className="text-white truncate">{item.name}</span> : null}
        </nav>
      )
    }
    return <div className="text-white font-medium truncate">{item.name ?? '未命名'}</div>
  }, [item, itemLoading])

  /* ====== 下一集卡片回调 ====== */
  const handlePlayNow = useCallback(() => {
    if (!nextEpisode) return
    autoPlayedRef.current = true
    clearCountdown()
    void navigate(`/player/${nextEpisode.id}`)
  }, [nextEpisode, autoPlayedRef, clearCountdown, navigate])

  const handleCancelCountdown = useCallback(() => {
    setAutoplayCancelled(true)
    clearCountdown()
    setBeforeEnded(false)
  }, [setAutoplayCancelled, clearCountdown, setBeforeEnded])

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

  return (
    <div className="pb-12 space-y-6">
      {/* 顶部 TopBar */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="返回"
          onClick={() => {
            if (window.history.length > 1) void navigate(-1)
            else void navigate('/')
          }}
          className="btn-ghost !p-2"
        >
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
          onBeforeEnded={onBeforeEndedHandler}
          onEnded={onEndedHandler}
        >
          {nextEpisode ? (
            <NextEpisodeCard
              nextEpisode={nextEpisode}
              countdown={countdown}
              beforeEnded={beforeEnded}
              autoplayCancelled={autoplayCancelled}
              onPlayNow={handlePlayNow}
              onCancel={handleCancelCountdown}
            />
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
              onClick={handleToggleFavorite}
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
              onClick={handleTogglePlayed}
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
        {item ? (
          <AdjacentEpisodes
            item={item}
            episodesLoading={episodes.loading}
            adjacentEpisodes={adjacentEpisodes}
          />
        ) : null}
      </div>
    </div>
  )
}
