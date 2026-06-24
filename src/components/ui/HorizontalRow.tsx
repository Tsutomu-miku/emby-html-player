import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import type { BaseItemDto } from '@/api/types'
import { PosterCard, type PosterSize, type PosterShape } from './PosterCard'
import { cx } from '@/utils'

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
  const widthClass = cx(
    // shrink-0 保证不被压缩；basis 控制尺寸
    'shrink-0',
    size === 'sm' && 'w-28 md:w-32',
    size === 'md' && 'w-36 md:w-44',
    size === 'lg' && 'w-48 md:w-60',
  )

  const skeletonCount = 8
  const aspectClass =
    shape === 'poster' ? 'aspect-[2/3]' : shape === 'backdrop' ? 'aspect-video' : 'aspect-square'

  return (
    <section className={cx('space-y-3', className)}>
      <header className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-jelly-text truncate">{title}</h2>
        {seeMoreHref && (
          <Link
            to={seeMoreHref}
            className="text-sm text-jelly-muted hover:text-jelly-accent shrink-0 transition-colors"
          >
            查看更多 →
          </Link>
        )}
      </header>

      <div className="overflow-x-auto flex gap-4 py-2 px-1 -mx-1">
        {loading
          ? Array.from({ length: skeletonCount }).map((_, i) => (
              <div key={i} className={widthClass}>
                <div className={cx('skeleton rounded-lg', aspectClass)} />
                <div className="mt-2 h-3 skeleton w-3/4 rounded" />
                <div className="mt-1 h-3 skeleton w-1/2 rounded" />
              </div>
            ))
          : items.map((item) => (
              <div key={item.id} className={widthClass}>
                <PosterCard
                  item={item}
                  size={size}
                  shape={shape}
                  showPlayButton={itemClickMode === 'play'}
                  clickMode={itemClickMode}
                />
                <div className="mt-1.5 truncate text-xs text-jelly-text" title={item.name}>
                  {item.name || '未命名'}
                </div>
              </div>
            ))}
      </div>
    </section>
  )
}
