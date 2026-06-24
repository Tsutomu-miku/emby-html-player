import { useEffect, useMemo, useRef, useState } from 'react'
import type { BaseItemDto, MediaSourceInfo, MediaStream, PlayMethod } from '@/api/types'
import { getSubtitleUrl } from '@/api/playback'
import { cx } from '@/utils'
import { formatDuration } from '@/utils/time'
import { ProgressBar } from './ProgressBar'

export interface ControlsProps {
  video: HTMLVideoElement | null
  container: HTMLElement | null
  item?: Pick<
    BaseItemDto,
    'name' | 'type' | 'indexNumber' | 'parentIndexNumber' | 'seriesName' | 'seasonName'
  >
  mediaSources: MediaSourceInfo[]
  currentMediaSourceId?: string
  onMediaSourceChange: (id: string) => void
  audioStreams: MediaStream[]
  currentAudioIndex?: number
  onAudioChange: (index: number) => void
  subtitleStreams: MediaStream[]
  currentSubtitleIndex: number | null
  onSubtitleChange: (index: number | null, mode: 'external' | 'encode') => void
  playbackRate: number
  onPlaybackRateChange: (r: number) => void
  hasPrev?: boolean
  hasNext?: boolean
  onPrev?: () => void
  onNext?: () => void
  show?: boolean
  titleOverlay?: React.ReactNode
  onBack?: () => void
  playMethod?: PlayMethod
  cycleSubtitles?: () => void
}

/* ======== 内联 SVG 图标（纯 path，无外部依赖）======== */
function IcBack(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  )
}
function IcPlay(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}
function IcPause(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
    </svg>
  )
}
function IcPrev(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M6 6h2v12H6zM9.5 12l8.5 6V6z" />
    </svg>
  )
}
function IcNext(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z" />
    </svg>
  )
}
function IcVolumeHigh(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M11 5 6 9H2v6h4l5 4V5z" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  )
}
function IcVolumeLow(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M11 5 6 9H2v6h4l5 4V5z" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  )
}
function IcVolumeMute(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M11 5 6 9H2v6h4l5 4V5z" />
      <line x1="22" y1="9" x2="16" y2="15" />
      <line x1="16" y1="9" x2="22" y2="15" />
    </svg>
  )
}
function IcCc(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M8 10a2 2 0 1 0 0 4" />
      <path d="M16 10a2 2 0 1 0 0 4" />
    </svg>
  )
}
function IcMusic(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  )
}
function IcTv(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2" y="6" width="20" height="14" rx="2" />
      <path d="M8 2h8l2 4H6z" />
    </svg>
  )
}
function IcPip(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <rect x="12" y="12" width="8" height="6" rx="1" />
    </svg>
  )
}
function IcFullscreen(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" />
    </svg>
  )
}
function IcFullscreenExit(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9 4v4H5M15 4v4h4M9 20v-4H5M15 20v-4h4" />
    </svg>
  )
}
function IcExternal(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M14 3h7v7" />
      <path d="M10 14 21 3" />
      <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
    </svg>
  )
}
function IcEncode(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m16 18 6-6-6-6" />
      <path d="M8 6 2 12l6 6" />
    </svg>
  )
}

/* ======== 辅助函数 ======== */
function formatBitrate(bps?: number): string {
  if (!bps || bps <= 0) return ''
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`
  return `${Math.round(bps / 1000)} kbps`
}

function mediaSourceTitle(ms: MediaSourceInfo): string {
  const codec = ms.mediaStreams.find((s) => s.type === 'Video')?.codec?.toUpperCase() ?? ''
  const w = ms.mediaStreams.find((s) => s.type === 'Video')?.width
  const sizeTag = w && w >= 3800 ? ' 4K' : w && w >= 1800 ? ' 1080p' : w && w >= 1200 ? ' 720p' : ''
  const name =
    ms.name ||
    (ms.container ? (codec ? `${codec}${sizeTag} · ${ms.container.toUpperCase()}` : ms.container.toUpperCase()) : 'Source')
  const br = formatBitrate(ms.bitrate)
  return br ? `${name} · ${br}` : name
}

function audioTitle(s: MediaStream): string {
  const parts: string[] = []
  if (s.displayTitle) return s.displayTitle
  if (s.language) parts.push(s.language)
  const codec = s.codec?.toUpperCase()
  if (codec) parts.push(codec)
  if (s.channels) parts.push(`${s.channels}ch`)
  if (s.isDefault) parts.push('默认')
  return parts.join(' · ') || `音轨 ${s.index}`
}

function subtitleTitle(s: MediaStream): string {
  if (s.displayTitle) return s.displayTitle
  const parts: string[] = []
  if (s.language) parts.push(s.language.toUpperCase())
  if (s.isForced) parts.push('(Forced)')
  if (s.isDefault) parts.push('(默认)')
  return parts.join(' ') || `字幕 ${s.index}`
}

/** 浏览器外挂字幕（vtt/srt/ass 文本类）是否可用 */
function isTextSubtitle(s: MediaStream): boolean {
  const c = (s.codec || '').toLowerCase()
  // 位图字幕（PGS/VobSub）一律不支持外挂
  if (/pgs|dvdsub|subrip_vobsub|vobsub/.test(c)) return false
  // 常见文本字幕都放行
  if (c === '') return true
  return /subrip|srt|vtt|webvtt|ass|ssa|ttml|txt|sub/.test(c)
}

/* ======== 下拉菜单封装 ======== */
type MenuKey = 'rate' | 'subtitle' | 'audio' | 'source'

function useMenuClose() {
  const [open, setOpen] = useState<MenuKey | null>(null)
  const onDocClick = (e: MouseEvent) => {
    const t = e.target as HTMLElement
    if (!t.closest('[data-player-menu]')) setOpen(null)
  }
  useEffect(() => {
    if (open) {
      document.addEventListener('mousedown', onDocClick)
      return () => document.removeEventListener('mousedown', onDocClick)
    }
  }, [open])
  return { open, setOpen }
}

export function Controls(props: ControlsProps) {
  const {
    video,
    container,
    item,
    mediaSources,
    currentMediaSourceId,
    onMediaSourceChange,
    audioStreams,
    currentAudioIndex,
    onAudioChange,
    subtitleStreams,
    currentSubtitleIndex,
    onSubtitleChange,
    playbackRate,
    onPlaybackRateChange,
    hasPrev,
    hasNext,
    onPrev,
    onNext,
    show,
    titleOverlay,
    onBack,
    playMethod,
  } = props

  const { open, setOpen } = useMenuClose()

  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isPaused, setIsPaused] = useState(true)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(document.fullscreenElement != null)
  const [isPip, setIsPip] = useState(
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    video ? (document.pictureInPictureElement === video) : false,
  )

  const canPip = typeof document !== 'undefined' && !!document.pictureInPictureEnabled

  // 同步 video 状态
  useEffect(() => {
    if (!video) return
    const onTime = () => setCurrent(video.currentTime || 0)
    const onLoaded = () => setDuration(video.duration || 0)
    const onPlay = () => setIsPaused(false)
    const onPause = () => setIsPaused(true)
    const onVol = () => {
      setIsMuted(video.muted)
      setVolume(video.volume)
    }
    const onRate = () => {
      if (video.playbackRate !== playbackRate) onPlaybackRateChange(video.playbackRate)
    }
    video.addEventListener('timeupdate', onTime)
    video.addEventListener('loadedmetadata', onLoaded)
    video.addEventListener('durationchange', onLoaded)
    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    video.addEventListener('volumechange', onVol)
    video.addEventListener('ratechange', onRate)
    onVol()
    setIsPaused(video.paused)
    return () => {
      video.removeEventListener('timeupdate', onTime)
      video.removeEventListener('loadedmetadata', onLoaded)
      video.removeEventListener('durationchange', onLoaded)
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('volumechange', onVol)
      video.removeEventListener('ratechange', onRate)
    }
  }, [video, playbackRate, onPlaybackRateChange])

  // 全屏 / pip 同步
  useEffect(() => {
    const onFs = () => setIsFullscreen(document.fullscreenElement != null)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  useEffect(() => {
    if (!video) return
    const onPip = () => {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      setIsPip(document.pictureInPictureElement === video)
    }
    video.addEventListener('enterpictureinpicture', onPip)
    video.addEventListener('leavepictureinpicture', onPip)
    return () => {
      video.removeEventListener('enterpictureinpicture', onPip)
      video.removeEventListener('leavepictureinpicture', onPip)
    }
  }, [video])

  // 同步 playbackRate
  useEffect(() => {
    if (video && video.playbackRate !== playbackRate) video.playbackRate = playbackRate
  }, [video, playbackRate])

  const togglePlay = () => {
    if (!video) return
    if (video.paused) void video.play().catch(() => {})
    else video.pause()
  }
  const toggleMute = () => {
    if (!video) return
    video.muted = !video.muted
  }
  const onVolumeSlider = (v: number) => {
    if (!video) return
    video.volume = v
    video.muted = v === 0
  }
  const toggleFullscreen = () => {
    if (!container) return
    if (!document.fullscreenElement) void container.requestFullscreen?.().catch(() => {})
    else void document.exitFullscreen?.().catch(() => {})
  }
  const togglePip = async () => {
    if (!video || !canPip) return
    try {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture?.()
      } else {
        await video.requestPictureInPicture?.()
      }
    } catch {
      /* ignore */
    }
  }

  const VolIcon = isMuted || volume <= 0 ? IcVolumeMute : volume < 0.5 ? IcVolumeLow : IcVolumeHigh

  // 字幕外部 URL 列表（用于 UI 判断）
  void getSubtitleUrl

  const canSwitchAudioDirect = useMemo(
    () => playMethod === 'Transcode' || audioStreams.length <= 1,
    [playMethod, audioStreams.length],
  )
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _audioBlocked = !canSwitchAudioDirect && audioStreams.length > 1

  /* ======== 顶部标题栏（根据传入 titleOverlay 或默认构建）======== */
  const topBar = (
    <div
      className={cx(
        'absolute top-0 left-0 right-0 z-20 flex items-center gap-3 px-4 py-3 text-white',
        'bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300',
        show ? 'opacity-100' : 'opacity-0 pointer-events-none',
      )}
    >
      <button
        type="button"
        onClick={onBack}
        aria-label="返回"
        className="p-2 -ml-2 rounded-full hover:bg-white/10 transition"
      >
        <IcBack className="w-5 h-5" />
      </button>
      <div className="flex-1 min-w-0 truncate text-sm sm:text-base font-medium">
        {titleOverlay ?? defaultTitle(item)}
      </div>
    </div>
  )

  /* ======== 渲染 ======== */
  return (
    <>
      {topBar}

      <div
        className={cx(
          'absolute bottom-0 left-0 right-0 z-20 flex flex-col',
          'bg-gradient-to-t from-black/85 via-black/40 to-transparent',
          'transition-opacity duration-300',
          show ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
      >
        {/* 进度条 */}
        <div className="px-3 sm:px-6 pt-14">
          <ProgressBar video={video} />
        </div>

        {/* 控制行 */}
        <div className="flex items-center justify-between gap-2 sm:gap-4 px-4 sm:px-6 pb-3 sm:pb-4 pt-1 text-white">
          {/* 左：播放 / 上/下一集 / 时间 */}
          <div className="flex items-center gap-1 sm:gap-2 min-w-0">
            <IconBtn onClick={togglePlay} ariaLabel={isPaused ? '播放' : '暂停'}>
              {isPaused ? <IcPlay className="w-5 h-5 sm:w-6 sm:h-6" /> : <IcPause className="w-5 h-5 sm:w-6 sm:h-6" />}
            </IconBtn>
            {hasPrev ? (
              <IconBtn onClick={onPrev} ariaLabel="上一集">
                <IcPrev className="w-5 h-5" />
              </IconBtn>
            ) : null}
            {hasNext ? (
              <IconBtn onClick={onNext} ariaLabel="下一集">
                <IcNext className="w-5 h-5" />
              </IconBtn>
            ) : null}
            <div className="text-xs sm:text-sm font-mono tabular-nums ml-1 sm:ml-2 text-white/90 whitespace-nowrap">
              <span>{formatDuration(current)}</span>
              <span className="mx-1 text-white/40">/</span>
              <span className="text-white/60">{formatDuration(duration)}</span>
            </div>
          </div>

          {/* 右：音量 / 倍速 / 字幕 / 音轨 / 源 / pip / 全屏 */}
          <div className="flex items-center gap-1 sm:gap-2 min-w-0">
            {/* 音量 */}
            <div className="group/vol flex items-center">
              <IconBtn onClick={toggleMute} ariaLabel={isMuted ? '取消静音' : '静音'}>
                <VolIcon className="w-5 h-5" />
              </IconBtn>
              <div className="w-0 group-hover/vol:w-24 overflow-hidden transition-all duration-200">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => onVolumeSlider(parseFloat(e.target.value))}
                  className="w-24 accent-jelly-accent cursor-pointer"
                  aria-label="音量"
                />
              </div>
            </div>

            {/* 倍速 */}
            <Menu
              data-player-menu="rate"
              open={open === 'rate'}
              onToggle={() => setOpen(open === 'rate' ? null : 'rate')}
              button={<span className="text-xs sm:text-sm font-semibold tabular-nums">{playbackRate}x</span>}
              buttonAria="播放速度"
              align="right"
            >
              {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((r) => (
                <MenuItem
                  key={r}
                  active={r === playbackRate}
                  onClick={() => {
                    onPlaybackRateChange(r)
                    setOpen(null)
                  }}
                >
                  {r === 1 ? '1x（正常）' : `${r}x`}
                </MenuItem>
              ))}
            </Menu>

            {/* 字幕 */}
            <Menu
              data-player-menu="subtitle"
              open={open === 'subtitle'}
              onToggle={() => setOpen(open === 'subtitle' ? null : 'subtitle')}
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

            {/* 音轨 */}
            <Menu
              data-player-menu="audio"
              open={open === 'audio'}
              onToggle={() => setOpen(open === 'audio' ? null : 'audio')}
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

            {/* 媒体源 */}
            <Menu
              data-player-menu="source"
              open={open === 'source'}
              onToggle={() => setOpen(open === 'source' ? null : 'source')}
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

            {/* 画中画 */}
            {canPip ? (
              <IconBtn onClick={() => void togglePip()} ariaLabel={isPip ? '退出画中画' : '画中画'}>
                <IcPip className="w-5 h-5" />
              </IconBtn>
            ) : null}

            {/* 全屏 */}
            <IconBtn onClick={toggleFullscreen} ariaLabel={isFullscreen ? '退出全屏' : '全屏'}>
              {isFullscreen ? (
                <IcFullscreenExit className="w-5 h-5" />
              ) : (
                <IcFullscreen className="w-5 h-5" />
              )}
            </IconBtn>
          </div>
        </div>
      </div>
    </>
  )
}

/* ======== 小部件：标题构建 ======== */
function defaultTitle(
  item?: Pick<BaseItemDto, 'name' | 'type' | 'indexNumber' | 'parentIndexNumber' | 'seriesName' | 'seasonName'>,
) {
  if (!item) return null
  const parts: string[] = []
  if (item.type === 'Episode') {
    if (item.seriesName) parts.push(item.seriesName)
    const s = item.parentIndexNumber
    const e = item.indexNumber
    if (s != null && e != null) parts.push(`S${String(s).padStart(2, '0')}E${String(e).padStart(2, '0')}`)
    if (item.name) parts.push(item.name)
  } else {
    if (item.name) parts.push(item.name)
  }
  return parts.join(' · ')
}

/* ======== 小部件：IconBtn ======== */
function IconBtn({
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
function Menu(props: {
  'data-player-menu'?: MenuKey | string
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

function MenuItem({
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
