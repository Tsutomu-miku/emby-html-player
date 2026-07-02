import { useEffect, useState, type CSSProperties } from 'react'
import { cx } from '@/utils'
import type { PlaybackStats } from './usePlaybackStats'
import './StatsOverlay.scss'

export const TOGGLE_EVENT = 'player:toggle-stats'
export const SET_VISIBLE_EVENT = 'player:set-stats-visible'

export interface StatsOverlayProps {
  stats: PlaybackStats
  className?: string
  style?: CSSProperties
}

/**
 * Small corner overlay with live playback telemetry.
 *
 * State is self-managed:
 *   - Keyboard: Ctrl/⌘ + Shift + I
 *   - Menu / Controls integration: dispatchEvent(new CustomEvent(TOGGLE_EVENT))
 *     or new CustomEvent(SET_VISIBLE_EVENT, { detail: boolean })
 *
 * Auto-appears as a mini pill during black-screen stalls (no decoded frame
 * while a play session is active) so anxious users see live metrics.
 */
export function StatsOverlay({ stats, className, style }: StatsOverlayProps) {
  const [visible, setVisible] = useState(false)
  const [autoDismissed, setAutoDismissed] = useState(false)

  useEffect(() => {
    if (!stats.isBlackScreen) setAutoDismissed(false)
  }, [stats.isBlackScreen])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key?.toLowerCase() !== 'i') return
      if (!(e.ctrlKey || e.metaKey) || !e.shiftKey) return
      e.preventDefault()
      e.stopPropagation()
      setVisible((v) => !v)
      setAutoDismissed(true)
    }
    function onToggleEvent() { setVisible((v) => !v); setAutoDismissed(true) }
    function onSetVisible(e: Event) {
      const val = (e as CustomEvent<boolean>).detail
      if (typeof val === 'boolean') { setVisible(val); setAutoDismissed(true) }
    }
    const opts: AddEventListenerOptions = { capture: true }
    window.addEventListener('keydown', onKey, opts)
    window.addEventListener(TOGGLE_EVENT, onToggleEvent)
    window.addEventListener(SET_VISIBLE_EVENT, onSetVisible)
    return () => {
      window.removeEventListener('keydown', onKey, opts)
      window.removeEventListener(TOGGLE_EVENT, onToggleEvent)
      window.removeEventListener(SET_VISIBLE_EVENT, onSetVisible)
    }
  }, [])

  const fullMode = visible
  const miniMode = !fullMode && stats.isBlackScreen && !autoDismissed
  if (!fullMode && !miniMode) return null

  const rows = buildRows(stats)
  const dismiss = () => { setVisible(false); setAutoDismissed(true) }
  const expand = () => { setVisible(true); setAutoDismissed(true) }

  if (miniMode) {
    const speed = stats.networkBytesPerSecond > 0 ? `${formatBytes(stats.networkBytesPerSecond)}/s` : null
    const br = stats.currentBitrateKbps > 0 ? formatBitrate(stats.currentBitrateKbps) : null
    const buf = `缓冲 ${stats.bufferedAheadSeconds.toFixed(1)} s`
    const pill = [speed, br, buf].filter(Boolean).join(' · ')
    return (
      <div
        className={cx('player-stats-overlay', 'player-stats-overlay--mini', className)}
        style={style}
        role="status"
        aria-label="黑屏期播放状态"
      >
        <span className="player-stats-overlay__mini-dot" />
        <span className="player-stats-overlay__mini-title">正在缓冲，视频即将出现…</span>
        <span className="player-stats-overlay__mini-pill">{pill}</span>
        <button
          type="button"
          className="player-stats-overlay__mini-expand"
          onClick={expand}
          title="查看完整统计 (Ctrl/⌘+Shift+I)"
        >
          详情
        </button>
        <button
          type="button"
          className="player-stats-overlay__close"
          aria-label="关闭"
          onClick={dismiss}
        >
          ×
        </button>
      </div>
    )
  }

  return (
    <div
      className={cx('player-stats-overlay', className)}
      style={style}
      aria-label="播放调试信息"
    >
      <div className="player-stats-overlay__header">
        <span className="player-stats-overlay__title">播放调试</span>
        <button
          type="button"
          className="player-stats-overlay__close"
          aria-label="关闭"
          onClick={dismiss}
          title="关闭 (Ctrl/⌘+Shift+I)"
        >
          ×
        </button>
      </div>
      <dl className="player-stats-overlay__rows">
        {rows.map(([k, v], i) => (
          <div key={i} className="player-stats-overlay__row">
            <dt className="player-stats-overlay__key">{k}</dt>
            <dd className="player-stats-overlay__value">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function buildRows(stats: PlaybackStats): Array<[string, string]> {
  const rows: Array<[string, string]> = []
  rows.push(['引擎', stats.engine || '—'])
  if (stats.sourceLabel) rows.push(['源', stats.sourceLabel])

  if (stats.currentBitrateKbps > 0) {
    rows.push(['当前码率', formatBitrate(stats.currentBitrateKbps)])
  }
  rows.push([
    '下行速度',
    stats.networkBytesPerSecond > 0 ? `${formatBytes(stats.networkBytesPerSecond)}/s` : 'N/A',
  ])
  rows.push(['缓冲', `${stats.bufferedAheadSeconds.toFixed(1)} s`])
  if (stats.resolution) rows.push(['分辨率', stats.resolution])
  if (stats.fps > 0) rows.push(['帧率', `${stats.fps.toFixed(3)} fps`])
  if (stats.videoCodec) {
    const hw = stats.hwdecActive === true ? ' (硬件)' : stats.hwdecActive === false ? ' (软解)' : ''
    rows.push(['视频编码', stats.videoCodec + hw])
  }
  if (stats.audioCodec) rows.push(['音频编码', stats.audioCodec])
  rows.push(['丢帧', String(stats.droppedFrames)])
  rows.push([
    '卡顿',
    `${stats.stallCount} 次 / ${stats.stallSecondsTotal.toFixed(1)} s`,
  ])
  return rows
}

function formatBitrate(kbps: number): string {
  if (!Number.isFinite(kbps) || kbps <= 0) return 'N/A'
  if (kbps >= 10_000) return `${(kbps / 1000).toFixed(1)} Mbps`
  if (kbps >= 1000) return `${(kbps / 1000).toFixed(2)} Mbps`
  return `${Math.round(kbps)} Kbps`
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${Math.round(bytes)} B`
}

/** Convenience helper: toggles the stats overlay without wiring props. */
export function toggleStatsOverlay(visible?: boolean) {
  if (typeof window === 'undefined') return
  if (visible === undefined) {
    window.dispatchEvent(new CustomEvent(TOGGLE_EVENT))
  } else {
    window.dispatchEvent(new CustomEvent(SET_VISIBLE_EVENT, { detail: visible }))
  }
}
