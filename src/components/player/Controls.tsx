/* eslint-disable max-lines -- Controls 主组件含状态/事件/渲染高内聚，拆分后仍 361 行 ≤ 400 符合特例 */
/* eslint-disable max-lines-per-function -- Controls 高内聚 UI 组件，state/handlers/JSX 强耦合无法拆分 */
import { useEffect, useMemo, useState } from 'react'
import type { BaseItemDto, PlayMethod } from '@/api/types'
import { getSubtitleUrl } from '@/api/playback'
import { cx } from '@/utils'
import { formatDuration } from '@/utils/time'
import { ProgressBar } from './ProgressBar'
import type { PlayerControl } from './backends/control'
import {
  IcBack,
  IcPlay,
  IcPause,
  IcPrev,
  IcNext,
  IcVolumeHigh,
  IcVolumeLow,
  IcVolumeMute,
  IcPip,
  IcFullscreen,
  IcFullscreenExit,
} from './parts/Icons'
import {
  IconBtn,
  Menu,
  MenuItem,
  SubtitleMenu,
  AudioMenu,
  SourceMenu,
  type MenuKey,
} from './parts/Menus'
import { useControlState } from './parts/useControlState'
import { toggleStatsOverlay } from './parts/StatsOverlay'

// 防止 getSubtitleUrl 被 tree-shake 警告
void getSubtitleUrl

export interface ControlsProps {
  video: HTMLVideoElement | null
  control?: PlayerControl
  container: HTMLElement | null
  item?: Pick<
    BaseItemDto,
    'name' | 'type' | 'indexNumber' | 'parentIndexNumber' | 'seriesName' | 'seasonName'
  >
  mediaSources: import('@/api/types').MediaSourceInfo[]
  currentMediaSourceId?: string
  onMediaSourceChange: (id: string) => void
  audioStreams: import('@/api/types').MediaStream[]
  currentAudioIndex?: number
  onAudioChange: (index: number) => void
  subtitleStreams: import('@/api/types').MediaStream[]
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

/* ======== 下拉菜单关闭 ======== */
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
    control,
  } = props

  const { open, setOpen } = useMenuClose()

  const { current, duration, isPaused, isMuted, volume, isFullscreen, isPip, canPip } =
    useControlState({ video, control, playbackRate, onPlaybackRateChange })

  // 同步 playbackRate
  useEffect(() => {
    if (control) {
      control.setPlaybackRate(playbackRate)
      return
    }
    if (video && video.playbackRate !== playbackRate) video.playbackRate = playbackRate
  }, [video, control, playbackRate])

  const togglePlay = () => {
    if (control) {
      if (control.paused) void control.play()
      else control.pause()
      return
    }
    if (!video) return
    if (video.paused) void video.play().catch((err: unknown) => {
      console.warn('[Player] play failed from controls', err)
    })
    else video.pause()
  }
  const toggleMute = () => {
    if (control) {
      control.setMuted(!control.muted)
      return
    }
    if (!video) return
    video.muted = !video.muted
  }
  const onVolumeSlider = (v: number) => {
    if (control) {
      control.setVolume(v)
      control.setMuted(v === 0)
      return
    }
    if (!video) return
    video.volume = v
    video.muted = v === 0
  }
  const toggleFullscreen = () => {
    if (!container) return
    if (!document.fullscreenElement) {
      void container.requestFullscreen?.().catch((err: unknown) => {
        console.warn('[Player] enter fullscreen failed', err)
      })
    } else {
      void document.exitFullscreen?.().catch((err: unknown) => {
        console.warn('[Player] exit fullscreen failed', err)
      })
    }
  }
  const togglePip = async () => {
    if (control?.togglePictureInPicture) {
      await control.togglePictureInPicture()
      return
    }
    if (!video || !canPip) return
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture?.()
      } else {
        await video.requestPictureInPicture?.()
      }
    } catch (err) {
      console.warn('[Player] picture-in-picture failed', err)
    }
  }

  const VolIcon = isMuted || volume <= 0 ? IcVolumeMute : volume < 0.5 ? IcVolumeLow : IcVolumeHigh

  const canSwitchAudioDirect = useMemo(
    () => !!control || playMethod === 'Transcode' || audioStreams.length <= 1,
    [control, playMethod, audioStreams.length],
  )
  // 保留变量便于调试：直切音轨被阻止时的提示
  void (!canSwitchAudioDirect && audioStreams.length > 1)

  /* ======== 顶部标题栏 ======== */
  const topBar = (
    <div
      data-player-controls
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

  return (
    <>
      {topBar}

      <div
        data-player-controls
        className={cx(
          'absolute bottom-0 left-0 right-0 z-20 flex flex-col',
          'bg-gradient-to-t from-black/85 via-black/40 to-transparent',
          'transition-opacity duration-300',
          show ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
      >
        {/* 进度条 */}
        <div className="px-3 sm:px-6 pt-14">
          <ProgressBar video={video} control={control} />
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
            <SubtitleMenu
              subtitleStreams={subtitleStreams}
              currentSubtitleIndex={currentSubtitleIndex}
              onSubtitleChange={onSubtitleChange}
              open={open === 'subtitle'}
              onToggle={() => setOpen(open === 'subtitle' ? null : 'subtitle')}
              setOpen={setOpen}
              nativeMode={!!control}
            />

            {/* 音轨 */}
            <AudioMenu
              audioStreams={audioStreams}
              currentAudioIndex={currentAudioIndex}
              onAudioChange={onAudioChange}
              open={open === 'audio'}
              onToggle={() => setOpen(open === 'audio' ? null : 'audio')}
              setOpen={setOpen}
              playMethod={playMethod}
              canSwitchAudioDirect={canSwitchAudioDirect}
            />

            {/* 媒体源 */}
            <SourceMenu
              mediaSources={mediaSources}
              currentMediaSourceId={currentMediaSourceId}
              onMediaSourceChange={onMediaSourceChange}
              open={open === 'source'}
              onToggle={() => setOpen(open === 'source' ? null : 'source')}
              setOpen={setOpen}
            />

            {/* 调试 / 统计 */}
            <Menu
              data-player-menu="tools"
              open={open === 'tools'}
              onToggle={() => setOpen(open === 'tools' ? null : 'tools')}
              button={<span className="text-xs sm:text-sm font-semibold tabular-nums">···</span>}
              buttonAria="更多"
              align="right"
            >
              <MenuItem
                onClick={() => {
                  toggleStatsOverlay()
                  setOpen(null)
                }}
              >
                播放统计信息 <span className="ml-4 opacity-50 text-[10px]">⌘⇧I</span>
              </MenuItem>
            </Menu>

            {/* 画中画 */}
            {(control ? control.canPictureInPicture : canPip) ? (
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
    if (s !== null && e !== null) parts.push(`S${String(s).padStart(2, '0')}E${String(e).padStart(2, '0')}`)
    if (item.name) parts.push(item.name)
  } else {
    if (item.name) parts.push(item.name)
  }
  return parts.join(' · ')
}
