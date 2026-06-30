/* eslint-disable max-lines -- 含 4 个格式化函数 + 3 个 UI 构建块 + 3 个菜单组件，311 行 ≤ 400 符合特例 */
import { useRef } from 'react'
import type { MediaSourceInfo, MediaStream, PlayMethod } from '@/api/types'
import { cx } from '@/utils'
import { isTextSubtitle } from './selectors'
import { IcCc, IcMusic, IcTv, IcExternal, IcEncode } from './Icons'

export { isTextSubtitle }

/* ======== 辅助函数 ======== */

export function formatBitrate(bps?: number): string {
  if (!bps || bps <= 0) return ''
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`
  return `${Math.round(bps / 1000)} kbps`
}

export function mediaSourceTitle(ms: MediaSourceInfo): string {
  const codec = ms.mediaStreams.find((s) => s.type === 'Video')?.codec?.toUpperCase() ?? ''
  const w = ms.mediaStreams.find((s) => s.type === 'Video')?.width
  const sizeTag = w && w >= 3800 ? ' 4K' : w && w >= 1800 ? ' 1080p' : w && w >= 1200 ? ' 720p' : ''
  const name =
    ms.name ||
    (ms.container ? (codec ? `${codec}${sizeTag} · ${ms.container.toUpperCase()}` : ms.container.toUpperCase()) : 'Source')
  const br = formatBitrate(ms.bitrate)
  return br ? `${name} · ${br}` : name
}

export function audioTitle(s: MediaStream): string {
  const parts: string[] = []
  if (s.displayTitle) return s.displayTitle
  if (s.language) parts.push(s.language)
  const codec = s.codec?.toUpperCase()
  if (codec) parts.push(codec)
  if (s.channels) parts.push(`${s.channels}ch`)
  if (s.isDefault) parts.push('默认')
  return parts.join(' · ') || `音轨 ${s.index}`
}

export function subtitleTitle(s: MediaStream): string {
  if (s.displayTitle) return s.displayTitle
  const parts: string[] = []
  if (s.language) parts.push(s.language.toUpperCase())
  if (s.isForced) parts.push('(Forced)')
  if (s.isDefault) parts.push('(默认)')
  return parts.join(' ') || `字幕 ${s.index}`
}

/* ======== 菜单键类型（与 Controls 共享）======== */
export type MenuKey = 'rate' | 'subtitle' | 'audio' | 'source'

/* ======== 小部件：IconBtn ======== */
export function IconBtn({
  children,
  onClick,
  ariaLabel,
}: {
  children: React.ReactNode
  onClick?: () => void
  ariaLabel: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={ariaLabel}
      className="p-2 rounded-full hover:bg-white/15 active:scale-95 transition disabled:opacity-40"
    >
      {children}
    </button>
  )
}

/* ======== 小部件：下拉 Menu ======== */
export function Menu(props: {
  'data-player-menu'?: string
  open: boolean
  onToggle: () => void
  button: React.ReactNode
  buttonAria: string
  children: React.ReactNode
  align?: 'left' | 'right'
  maxHeight?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div ref={ref} data-player-menu={props['data-player-menu']} className="relative">
      <IconBtn onClick={props.onToggle} ariaLabel={props.buttonAria}>
        {props.button}
      </IconBtn>
      {props.open && (
        <div
          className={cx(
            'absolute bottom-full mb-2 min-w-[12rem] max-w-[18rem] rounded-lg shadow-2xl ring-1 ring-white/10',
            'bg-jelly-panel/95 backdrop-blur text-white overflow-hidden z-50',
            props.align === 'right' ? 'right-0' : 'left-0',
          )}
          style={props.maxHeight ? { maxHeight: props.maxHeight, overflowY: 'auto' } : undefined}
        >
          {props.children}
        </div>
      )}
    </div>
  )
}

export function MenuItem({
  active,
  onClick,
  children,
  className,
}: {
  active?: boolean
  onClick?: () => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'w-full flex items-center text-left px-3 py-2 text-sm transition',
        active ? 'bg-jelly-accent/25 text-white font-medium' : 'text-white/90 hover:bg-white/10',
        className,
      )}
    >
      {children}
    </button>
  )
}

/* ======== 字幕菜单 ======== */
interface SubtitleMenuProps {
  subtitleStreams: MediaStream[]
  currentSubtitleIndex: number | null
  onSubtitleChange: (index: number | null, mode: 'external' | 'encode') => void
  open: boolean
  onToggle: () => void
  setOpen: (k: null) => void
  nativeMode?: boolean
}

export function SubtitleMenu({
  subtitleStreams,
  currentSubtitleIndex,
  onSubtitleChange,
  open,
  onToggle,
  setOpen,
  nativeMode,
}: SubtitleMenuProps) {
  return (
    <Menu
      data-player-menu="subtitle"
      open={open}
      onToggle={onToggle}
      button={<IcCc className="w-5 h-5" />}
      buttonAria="字幕"
      align="right"
      maxHeight={280}
    >
      <MenuItem
        active={currentSubtitleIndex === null}
        onClick={() => {
          onSubtitleChange(null, 'external')
          setOpen(null)
        }}
        className="justify-center"
      >
        <span className="text-sm">关闭字幕</span>
      </MenuItem>
      {subtitleStreams.length === 0 && (
        <div className="px-3 py-3 text-xs text-white/50">暂无字幕轨</div>
      )}
      {subtitleStreams.map((s) => {
        const active = currentSubtitleIndex === s.index
        const canExternal = isTextSubtitle(s)
        if (nativeMode) {
          return (
            <MenuItem
              key={s.index}
              active={active}
              onClick={() => {
                onSubtitleChange(s.index, 'external')
                setOpen(null)
              }}
            >
              {subtitleTitle(s)}
            </MenuItem>
          )
        }
        return (
          <div
            key={s.index}
            className={cx(
              'flex items-center gap-2 px-3 py-2 text-sm',
              active ? 'bg-jelly-accent/20 text-white' : 'text-white/90 hover:bg-white/10',
            )}
          >
            <div className="flex-1 min-w-0 truncate" title={subtitleTitle(s)}>
              {subtitleTitle(s)}
            </div>
            <button
              type="button"
              title={canExternal ? '外挂字幕（浏览器渲染）' : '该字幕为位图，不支持外挂，请使用烧录'}
              disabled={!canExternal}
              className={cx(
                'p-1 rounded hover:bg-white/15 disabled:opacity-30 disabled:cursor-not-allowed transition',
                active ? 'ring-1 ring-jelly-accent/60' : '',
              )}
              onClick={() => {
                if (!canExternal) return
                onSubtitleChange(s.index, 'external')
                setOpen(null)
              }}
            >
              <IcExternal className="w-4 h-4" />
            </button>
            <button
              type="button"
              title="烧录（硬字幕，嵌入画面，需要转码）"
              className={cx(
                'p-1 rounded hover:bg-white/15 transition',
                active ? 'ring-1 ring-jelly-accent/60' : '',
              )}
              onClick={() => {
                onSubtitleChange(s.index, 'encode')
                setOpen(null)
              }}
            >
              <IcEncode className="w-4 h-4" />
            </button>
          </div>
        )
      })}
    </Menu>
  )
}

/* ======== 音轨菜单 ======== */
interface AudioMenuProps {
  audioStreams: MediaStream[]
  currentAudioIndex?: number
  onAudioChange: (index: number) => void
  open: boolean
  onToggle: () => void
  setOpen: (k: null) => void
  playMethod?: PlayMethod
  canSwitchAudioDirect: boolean
}

export function AudioMenu({
  audioStreams,
  currentAudioIndex,
  onAudioChange,
  open,
  onToggle,
  setOpen,
  playMethod,
  canSwitchAudioDirect,
}: AudioMenuProps) {
  return (
    <Menu
      data-player-menu="audio"
      open={open}
      onToggle={onToggle}
      button={<IcMusic className="w-5 h-5" />}
      buttonAria="音轨"
      align="right"
      maxHeight={280}
    >
      {audioStreams.length === 0 && (
        <div className="px-3 py-3 text-xs text-white/50">暂无音轨</div>
      )}
      {!canSwitchAudioDirect && audioStreams.length > 1 && (
        <div className="px-3 py-2 text-[11px] leading-snug text-amber-300/90 border-b border-white/10">
          当前为 {playMethod}，浏览器可能不支持直接切换音轨。切换后无响应请改用转码源。
        </div>
      )}
      {audioStreams.map((s) => (
        <MenuItem
          key={s.index}
          active={currentAudioIndex === s.index}
          onClick={() => {
            onAudioChange(s.index)
            setOpen(null)
          }}
        >
          {audioTitle(s)}
        </MenuItem>
      ))}
    </Menu>
  )
}

/* ======== 媒体源菜单 ======== */
interface SourceMenuProps {
  mediaSources: MediaSourceInfo[]
  currentMediaSourceId?: string
  onMediaSourceChange: (id: string) => void
  open: boolean
  onToggle: () => void
  setOpen: (k: null) => void
}

export function SourceMenu({
  mediaSources,
  currentMediaSourceId,
  onMediaSourceChange,
  open,
  onToggle,
  setOpen,
}: SourceMenuProps) {
  return (
    <Menu
      data-player-menu="source"
      open={open}
      onToggle={onToggle}
      button={<IcTv className="w-5 h-5" />}
      buttonAria="媒体源"
      align="right"
      maxHeight={320}
    >
      {mediaSources.map((ms) => (
        <MenuItem
          key={ms.id}
          active={currentMediaSourceId === ms.id}
          onClick={() => {
            onMediaSourceChange(ms.id)
            setOpen(null)
          }}
        >
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="truncate">{mediaSourceTitle(ms)}</span>
            <span className="text-[11px] text-white/50 truncate">
              {[
                ms.supportsDirectPlay ? 'DirectPlay' : null,
                ms.supportsDirectStream ? 'DirectStream' : null,
                ms.supportsTranscoding ? 'Transcode' : null,
              ]
                .filter(Boolean)
                .join(' / ')}
            </span>
          </div>
        </MenuItem>
      ))}
    </Menu>
  )
}
