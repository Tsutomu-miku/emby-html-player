import { Link } from 'react-router-dom'
import type { BaseItemDto } from '@/api/types'
import { cx } from '@/utils'

/**
 * InfoPanel: 左侧海报 + 右侧内容列（按钮组 / 关联信息 / Overview / 上/下一集）
 */
export function InfoPanel({
  item,
  posterSrc,
  series,
  prevEp,
  nextEp,
  isFav,
  isPlayed,
  onPlay,
  onToggleFav,
  onTogglePlayed,
  onCopyLink,
  onNavigateToEpisode,
  overviewExpanded,
  onToggleOverview,
}: {
  item: BaseItemDto
  posterSrc: string
  series?: BaseItemDto
  prevEp?: BaseItemDto
  nextEp?: BaseItemDto
  isFav: boolean | null
  isPlayed: boolean | null
  onPlay: () => void
  onToggleFav: () => void
  onTogglePlayed: () => void
  onCopyLink: () => void
  onNavigateToEpisode: (id: string) => void
  overviewExpanded: boolean
  onToggleOverview: () => void
}) {
  const type = item.type

  return (
    <div className="mt-[-80px] md:mt-[-96px] relative px-2 md:px-4 flex flex-col md:flex-row gap-4 md:gap-6">
      {/* 左侧海报 */}
      <div className="w-36 md:w-48 md:w-56 shrink-0 mx-auto md:mx-0">
        <img
          src={posterSrc}
          alt={item.name || ''}
          className="w-full aspect-[2/3] rounded-xl shadow-2xl object-cover border border-white/10"
          onError={(e) => {
            e.currentTarget.onerror = null
            e.currentTarget.src =
              "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='300'><rect width='200' height='300' fill='%2320232c'/></svg>"
          }}
        />
      </div>

      {/* 中间内容 */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* 按钮组 */}
        <div className="flex flex-wrap gap-2">
          <button onClick={onPlay} className="btn" type="button">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <polygon points="6 4 20 12 6 20 6 4" />
            </svg>
            播放
          </button>
          <button
            onClick={onToggleFav}
            className={cx('btn-ghost', isFav && '!text-red-400 !bg-red-500/10')}
            type="button"
            aria-label={isFav ? '取消收藏' : '收藏'}
          >
            <svg
              viewBox="0 0 24 24"
              fill={isFav ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            {isFav ? '已收藏' : '收藏'}
          </button>
          <button
            onClick={onTogglePlayed}
            className="btn-ghost"
            type="button"
            aria-label={isPlayed ? '标记未看' : '标记已看'}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {isPlayed ? '已看' : '标记已看'}
          </button>
          <button onClick={onCopyLink} className="btn-ghost" type="button">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
            >
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            复制链接
          </button>
        </div>

        {/* Episode：关联信息 */}
        {type === 'Episode' && series?.name && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-jelly-muted">
            <span>本集属于</span>
            <Link to={`/item/${series.id}`} className="text-jelly-accent hover:underline">
              {series.name}
            </Link>
            {item.parentIndexNumber !== null && item.parentIndexNumber !== undefined && (
              <span>· 第 {item.parentIndexNumber} 季</span>
            )}
          </div>
        )}
        {type === 'Season' && series?.name && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-jelly-muted">
            <span>属于系列</span>
            <Link to={`/item/${series.id}`} className="text-jelly-accent hover:underline">
              {series.name}
            </Link>
          </div>
        )}

        {/* Overview */}
        {item.overview && (
          <div>
            <h3 className="text-sm font-semibold text-jelly-muted uppercase tracking-wide mb-2">
              简介
            </h3>
            <p
              className={cx(
                'text-sm md:text-base text-jelly-text leading-relaxed whitespace-pre-wrap',
                !overviewExpanded && 'line-clamp-4',
              )}
              style={
                !overviewExpanded
                  ? {
                      display: '-webkit-box',
                      WebkitLineClamp: 4,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }
                  : undefined
              }
            >
              {item.overview}
            </p>
            {item.overview.length > 120 && (
              <button
                onClick={onToggleOverview}
                className="mt-1 text-sm text-jelly-accent hover:underline"
                type="button"
              >
                {overviewExpanded ? '收起' : '展开'}
              </button>
            )}
          </div>
        )}

        {/* Episode 上/下一集 */}
        {type === 'Episode' && (prevEp || nextEp) && (
          <div className="flex flex-wrap gap-2">
            {prevEp && (
              <button
                onClick={() => onNavigateToEpisode(prevEp.id)}
                className="btn-ghost text-sm"
                type="button"
              >
                &larr; 上一集
                {prevEp.indexNumber !== null && prevEp.indexNumber !== undefined &&
                  ` (E${prevEp.indexNumber})`}
              </button>
            )}
            {nextEp && (
              <button
                onClick={() => onNavigateToEpisode(nextEp.id)}
                className="btn-ghost text-sm"
                type="button"
              >
                下一集
                {nextEp.indexNumber !== null && nextEp.indexNumber !== undefined &&
                  ` (E${nextEp.indexNumber})`}{' '}
                &rarr;
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
