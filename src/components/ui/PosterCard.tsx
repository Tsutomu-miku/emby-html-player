import { Link, useNavigate } from 'react-router-dom'
import type { BaseItemDto } from '@/api/types'
import { posterUrl, backdropUrl, thumbUrl } from '@/api/images'
import { ticksToSeconds, formatDurationShort } from '@/utils/time'
import { cx } from '@/utils'

export type PosterSize = 'sm' | 'md' | 'lg'
export type PosterShape = 'poster' | 'backdrop' | 'square'

export interface PosterCardProps {
  item: BaseItemDto
  size?: PosterSize
  shape?: PosterShape
  showPlayButton?: boolean
  clickMode?: 'detail' | 'play'
  className?: string
}

/** 图片加载失败时的占位 SVG data URI */
function placeholderUri(color = '#1a1c22'): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='${color}'/></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const SHAPE_ASPECT: Record<PosterShape, string> = {
  poster: 'aspect-[2/3]',
  backdrop: 'aspect-video',
  square: 'aspect-square',
}

/**
 * 通用海报卡片组件。
 * - 支持 poster / backdrop / square 三种比例
 * - 自动显示底部进度条、右上角已看徽章、左上角类型角标
 * - 悬停显示底部浮层（标题 + 年份 + 时长）
 * - 右下角可选播放按钮
 */
export function PosterCard({
  item,
  size = 'md',
  shape = 'poster',
  showPlayButton = false,
  clickMode = 'detail',
  className,
}: PosterCardProps) {
  const navigate = useNavigate()

  const aspect = SHAPE_ASPECT[shape]
  let imgSrc = ''
  if (shape === 'backdrop') {
    imgSrc = backdropUrl(item, { quality: 70, placeholderOnMissing: true })
  } else {
    // poster 或 square 都用 Primary（海报图）
    imgSrc = posterUrl(item, { quality: 70, placeholderOnMissing: true })
  }

  // 进度条
  const position = item.userData?.playbackPositionTicks ?? 0
  const runTime = item.runTimeTicks ?? 0
  const progress = position > 0 && runTime > 0 ? (position / runTime) * 100 : 0

  // 左上角类型角标
  let badge: React.ReactNode = null
  if (item.type === 'Episode') {
    const s = item.parentIndexNumber ?? 0
    const e = item.indexNumber ?? 0
    badge = (
      <span className="absolute top-1.5 left-1.5 z-10 px-1.5 py-0.5 rounded text-[10px] font-medium bg-black/70 text-white backdrop-blur-sm">
        S{s}E{e}
      </span>
    )
  } else if (item.type === 'Season') {
    const s = item.parentIndexNumber ?? 0
    badge = (
      <span className="absolute top-1.5 left-1.5 z-10 px-1.5 py-0.5 rounded text-[10px] font-medium bg-black/70 text-white backdrop-blur-sm">
        S {s}
      </span>
    )
  }

  // 已看徽章
  const played = item.userData?.played === true

  // 年份 + 时长
  const subParts: string[] = []
  if (item.productionYear) subParts.push(String(item.productionYear))
  if (item.runTimeTicks) subParts.push(formatDurationShort(ticksToSeconds(item.runTimeTicks)))
  const subText = subParts.join(' · ')

  const to = clickMode === 'play' ? `/player/${item.id}` : `/item/${item.id}`

  return (
    <Link
      to={to}
      className={cx(
        'group relative block rounded-lg overflow-hidden bg-jelly-card transition-transform hover:-translate-y-0.5 hover:shadow-lg',
        size === 'sm' && 'text-[11px]',
        size === 'md' && 'text-xs',
        size === 'lg' && 'text-sm',
        aspect,
        className,
      )}
    >
      <img
        src={imgSrc}
        alt={item.name || ''}
        loading="lazy"
        decoding="async"
        onError={(e) => {
          const t = e.currentTarget
          t.onerror = null
          t.src = placeholderUri()
        }}
        className="w-full h-full object-cover"
      />

      {/* 类型角标 */}
      {badge}

      {/* 已看徽章：右上角 */}
      {played && (
        <span className="absolute top-1.5 right-1.5 z-10 w-5 h-5 rounded-full bg-jelly-accent text-white flex items-center justify-center text-xs shadow">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
      )}

      {/* 右下角小播放按钮 */}
      {showPlayButton && (
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            navigate(`/player/${item.id}`)
          }}
          className="absolute bottom-2 right-2 z-10 w-8 h-8 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm hover:bg-jelly-accent"
          aria-label="播放"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 translate-x-[1px]">
            <polygon points="6 4 20 12 6 20 6 4" />
          </svg>
        </button>
      )}

      {/* 底部进度条 */}
      {progress > 0 && progress < 100 && (
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-black/30">
          <div
            className="h-full bg-jelly-accent"
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
      )}

      {/* 悬停浮层 */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-8 pb-2 px-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="truncate font-medium text-white text-xs md:text-sm" title={item.name}>
          {item.name || '未命名'}
        </div>
        {subText && (
          <div className="truncate text-[10px] md:text-xs text-jelly-muted mt-0.5">
            {subText}
          </div>
        )}
      </div>
    </Link>
  )
}

// 重新导出 thumbUrl 方便其他组件使用
export { thumbUrl }
