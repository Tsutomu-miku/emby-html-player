import { Link, useNavigate } from 'react-router-dom'
import type { BaseItemDto } from '@/api/types'
import { posterUrl, backdropUrl, thumbUrl } from '@/api/images'
import { ticksToSeconds, formatDurationShort } from '@/utils/time'
import { cx } from '@/utils'
import './PosterCard.scss'

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

  const imgSrc =
    shape === 'backdrop'
      ? backdropUrl(item, { quality: 70, placeholderOnMissing: true })
      : posterUrl(item, { quality: 70, placeholderOnMissing: true })

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
      <span className="poster-card__badge">
        S{s}E{e}
      </span>
    )
  } else if (item.type === 'Season') {
    const s = item.parentIndexNumber ?? 0
    badge = (
      <span className="poster-card__badge">
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
        'poster-card',
        `poster-card--${shape}`,
        `poster-card--${size}`,
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
        className="poster-card__image"
      />

      {/* 类型角标 */}
      {badge}

      {/* 已看徽章：右上角 */}
      {played && (
        <span className="poster-card__played">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
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
            void navigate(`/player/${item.id}`)
          }}
          className="poster-card__play"
          aria-label="播放"
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <polygon points="6 4 20 12 6 20 6 4" />
          </svg>
        </button>
      )}

      {/* 底部进度条 */}
      {progress > 0 && progress < 100 && (
        <div className="poster-card__progress">
          <div
            className="poster-card__progress-bar"
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
      )}

      {/* 悬停浮层 */}
      <div className="poster-card__overlay">
        <div className="poster-card__title" title={item.name}>
          {item.name || '未命名'}
        </div>
        {subText && (
          <div className="poster-card__meta">
            {subText}
          </div>
        )}
      </div>
    </Link>
  )
}

// 重新导出 thumbUrl 方便其他组件使用
export { thumbUrl }
