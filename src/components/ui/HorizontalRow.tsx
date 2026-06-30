import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import type { BaseItemDto } from '@/api/types'
import { PosterCard, type PosterSize, type PosterShape } from './PosterCard'
import { cx } from '@/utils'
import './HorizontalRow.scss'

interface HorizontalRowProps {
  title: ReactNode
  items: BaseItemDto[]
  seeMoreHref?: string
  size?: PosterSize
  shape?: PosterShape
  loading?: boolean
  itemClickMode?: 'detail' | 'play'
  className?: string
}

/**
 * 横向滚动的海报行。
 * - loading=true 时渲染 8 个 skeleton 卡片
 * - items 为空且 !loading 时整个行不渲染
 */
export function HorizontalRow({
  title,
  items,
  seeMoreHref,
  size = 'md',
  shape = 'poster',
  loading = false,
  itemClickMode = 'detail',
  className,
}: HorizontalRowProps) {
  // 空态：不渲染
  if (!loading && (!items || items.length === 0)) return null

  // 每张卡片在横滚容器中的宽度
  const itemClass = cx('media-row__item', `media-row__item--${size}`)

  const skeletonCount = 8
  const aspectClass =
    shape === 'poster' ? 'is-poster' : shape === 'backdrop' ? 'is-backdrop' : 'is-square'

  return (
    <section className={cx('media-row', className)}>
      <header className="media-row__header">
        <h2 className="media-row__title">{title}</h2>
        {seeMoreHref && (
          <Link
            to={seeMoreHref}
            className="media-row__more"
          >
            查看更多
          </Link>
        )}
      </header>

      <div className="media-row__scroller">
        {loading
          ? Array.from({ length: skeletonCount }).map((_, i) => (
              <div key={i} className={itemClass}>
                <div className={cx('media-row__skeleton skeleton', aspectClass)} />
                <div className="media-row__skeleton-line skeleton" />
                <div className="media-row__skeleton-line media-row__skeleton-line--short skeleton" />
              </div>
            ))
          : items.map((item) => (
              <div key={item.id} className={itemClass}>
                <PosterCard
                  item={item}
                  size={size}
                  shape={shape}
                  showPlayButton={itemClickMode === 'play'}
                  clickMode={itemClickMode}
                />
                <div className="media-row__caption" title={item.name}>
                  {item.name || '未命名'}
                </div>
              </div>
            ))}
      </div>
    </section>
  )
}
