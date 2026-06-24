import { useEffect, useRef, useState } from 'react'
import { cx } from '@/utils'
import { formatDuration } from '@/utils/time'

export interface ProgressBarProps {
  video: HTMLVideoElement | null
  className?: string
}

/**
 * 播放器进度条：
 * - 绝对高度 h-1.5 / hover:h-2.5 transition
 * - 轨道 bg-white/10；已加载 bg-white/20；已播放 bg-jelly-accent
 * - 支持点击跳转 + 指针拖拽（文档级监听，可拖出轨道）
 * - 悬停显示时间气泡
 */
export function ProgressBar({ video, className }: ProgressBarProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [bufferedEnd, setBufferedEnd] = useState(0)
  const [hoverRatio, setHoverRatio] = useState<number | null>(null)
  const draggingRef = useRef(false)
  const wasPausedRef = useRef(false)

  useEffect(() => {
    if (!video) return
    const onTime = () => {
      if (draggingRef.current) return
      setCurrent(video.currentTime || 0)
    }
    const onLoaded = () => {
      setDuration(video.duration || 0)
    }
    const onProgress = () => {
      if (!video.buffered || !video.buffered.length) {
        setBufferedEnd(0)
        return
      }
      setBufferedEnd(video.buffered.end(video.buffered.length - 1) || 0)
    }
    video.addEventListener('timeupdate', onTime)
    video.addEventListener('loadedmetadata', onLoaded)
    video.addEventListener('durationchange', onLoaded)
    video.addEventListener('progress', onProgress)
    onProgress()
    return () => {
      video.removeEventListener('timeupdate', onTime)
      video.removeEventListener('loadedmetadata', onLoaded)
      video.removeEventListener('durationchange', onLoaded)
      video.removeEventListener('progress', onProgress)
    }
  }, [video])

  const seekByRatio = (ratio: number) => {
    const r = Math.max(0, Math.min(1, ratio))
    if (!video || !isFinite(duration) || duration <= 0) return
    video.currentTime = r * duration
    setCurrent(r * duration)
  }

  const clientXToRatio = (clientX: number) => {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return 0
    return (clientX - rect.left) / rect.width
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!video) return
    draggingRef.current = true
    wasPausedRef.current = video.paused
    video.pause()
    seekByRatio(clientXToRatio(e.clientX))
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = clientXToRatio(e.clientX)
    if (draggingRef.current) {
      seekByRatio(r)
    }
    setHoverRatio(r)
  }

  const onPointerLeave = () => setHoverRatio(null)

  const onPointerUp = () => {
    if (draggingRef.current && video) {
      draggingRef.current = false
      if (!wasPausedRef.current) void video.play().catch(() => {})
    }
  }

  const playedRatio = duration > 0 ? current / duration : 0
  const bufferedRatio = duration > 0 ? bufferedEnd / duration : 0

  return (
    <div
      ref={wrapRef}
      className={cx(
        'group/progress relative w-full cursor-pointer select-none py-3 -my-2',
        'transition-[height]',
        className,
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={onPointerLeave}
    >
      {/* 实际可视轨道 */}
      <div className="relative h-1.5 group-hover/progress:h-2.5 transition-all duration-150 rounded-full bg-white/10 overflow-hidden">
        {/* 已缓冲 */}
        <div
          className="absolute inset-y-0 left-0 bg-white/20"
          style={{ width: `${(bufferedRatio * 100).toFixed(3)}%` }}
        />
        {/* 已播放 */}
        <div
          className="absolute inset-y-0 left-0 bg-jelly-accent"
          style={{ width: `${(playedRatio * 100).toFixed(3)}%` }}
        />
        {/* 旋钮 */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-[0_0_6px_rgba(0,164,220,0.8)] opacity-0 group-hover/progress:opacity-100 transition-opacity"
          style={{ left: `calc(${(playedRatio * 100).toFixed(3)}% - 6px)` }}
        />
      </div>

      {/* hover 时间气泡 */}
      {hoverRatio != null && (
        <div
          className="absolute -top-8 px-2 py-0.5 text-xs rounded bg-black/80 text-white pointer-events-none -translate-x-1/2 whitespace-nowrap"
          style={{ left: `${(hoverRatio * 100).toFixed(2)}%` }}
        >
          {formatDuration(hoverRatio * (duration || 0))}
        </div>
      )}
    </div>
  )
}
