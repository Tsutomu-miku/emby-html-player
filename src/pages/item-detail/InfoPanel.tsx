import { Link } from 'react-router-dom'
import type { BaseItemDto } from '@/api/types'
import { cx } from '@/utils'
import { formatDurationShort, ticksToSeconds } from '@/utils/time'

function buildMetaChips(item: BaseItemDto): string[] {
  const chips: string[] = []
  if (item.productionYear) chips.push(String(item.productionYear))
  if (item.runTimeTicks) chips.push(formatDurationShort(ticksToSeconds(item.runTimeTicks)))
  if (item.officialRating) chips.push(item.officialRating)
  if (item.communityRating) chips.push(`评分 ${item.communityRating.toFixed(1)}`)
  item.genres?.slice(0, 3).forEach((genre) => chips.push(genre))
  return chips
}

function hasValue<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}

function getEyebrow(item: BaseItemDto, series?: BaseItemDto): string {
  if (item.type === 'Episode') {
    const parts = [
      item.seriesName || series?.name,
      hasValue(item.parentIndexNumber) ? `第 ${item.parentIndexNumber} 季` : '',
      hasValue(item.indexNumber) ? `第 ${item.indexNumber} 集` : '',
    ].filter(Boolean)
    return parts.join(' / ')
  }
  if (item.type === 'Season' && series?.name) return series.name
  return item.type || ''
}

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
  const metaChips = buildMetaChips(item)
  const eyebrow = getEyebrow(item, series)
  const title = item.name || '未命名'

  return (
    <section className="item-detail-info">
      <div className="item-detail-info__poster">
        <img
          src={posterSrc}
          alt={item.name || ''}
          className="item-detail-info__poster-box"
          onError={(e) => {
            e.currentTarget.onerror = null
            e.currentTarget.src =
              "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='300'><rect width='200' height='300' fill='%2320232c'/></svg>"
          }}
        />
      </div>

      <div className="item-detail-info__content">
        <div className="item-detail-info__identity">
          {eyebrow ? <div className="item-detail-info__eyebrow">{eyebrow}</div> : null}
          <h1 className="item-detail-info__title">{title}</h1>
          {item.originalTitle && item.originalTitle !== item.name ? (
            <div className="item-detail-info__original">{item.originalTitle}</div>
          ) : null}
          {metaChips.length > 0 ? (
            <div className="item-detail-info__chips">
              {metaChips.map((chip) => (
                <span key={chip} className="chip">
                  {chip}
                </span>
              ))}
            </div>
          ) : null}
          {item.tagline ? <p className="item-detail-info__tagline">{item.tagline}</p> : null}
        </div>

        <div className="item-detail-info__actions">
          <ActionButton tone="primary" onClick={onPlay} label="播放" icon="play" />
          <ActionButton
            active={isFav === true}
            onClick={onToggleFav}
            label={isFav ? '已收藏' : '收藏'}
            icon="favorite"
          />
          <ActionButton
            active={isPlayed === true}
            onClick={onTogglePlayed}
            label={isPlayed ? '已看' : '标记已看'}
            icon="check"
          />
          <ActionButton onClick={onCopyLink} label="复制链接" icon="link" />
        </div>

        {type === 'Episode' && series?.name && (
          <div className="item-detail-info__relation">
            <span>本集属于</span>
            <Link to={`/item/${series.id}`}>
              {series.name}
            </Link>
            {hasValue(item.parentIndexNumber) && (
              <span>· 第 {item.parentIndexNumber} 季</span>
            )}
          </div>
        )}
        {type === 'Season' && series?.name && (
          <div className="item-detail-info__relation">
            <span>属于系列</span>
            <Link to={`/item/${series.id}`}>
              {series.name}
            </Link>
          </div>
        )}

        {item.overview && (
          <div className="item-detail-info__overview">
            <h2>简介</h2>
            <p
              className={cx(
                'item-detail-info__overview-text',
                !overviewExpanded && 'item-detail-info__overview-text--clamped',
              )}
            >
              {item.overview}
            </p>
            {item.overview.length > 120 && (
              <button
                onClick={onToggleOverview}
                className="item-detail-info__expand"
                type="button"
              >
                {overviewExpanded ? '收起' : '展开'}
              </button>
            )}
          </div>
        )}

        {type === 'Episode' && (prevEp || nextEp) && (
          <div className="item-detail-info__adjacent">
            {prevEp && (
              <button
                onClick={() => onNavigateToEpisode(prevEp.id)}
                className="btn-ghost"
                type="button"
              >
                &larr; 上一集
                {hasValue(prevEp.indexNumber) &&
                  ` (E${prevEp.indexNumber})`}
              </button>
            )}
            {nextEp && (
              <button
                onClick={() => onNavigateToEpisode(nextEp.id)}
                className="btn-ghost"
                type="button"
              >
                下一集
                {hasValue(nextEp.indexNumber) &&
                  ` (E${nextEp.indexNumber})`}{' '}
                &rarr;
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

function ActionButton({
  label,
  icon,
  onClick,
  active = false,
  tone = 'ghost',
}: {
  label: string
  icon: 'check' | 'favorite' | 'link' | 'play'
  onClick: () => void
  active?: boolean
  tone?: 'ghost' | 'primary'
}) {
  return (
    <button
      type="button"
      className={cx(tone === 'primary' ? 'btn' : 'btn-ghost', active && 'is-active')}
      onClick={onClick}
      aria-pressed={active}
    >
      <ActionIcon name={icon} filled={active || tone === 'primary'} />
      {label}
    </button>
  )
}

function ActionIcon({
  name,
  filled,
}: {
  name: 'check' | 'favorite' | 'link' | 'play'
  filled: boolean
}) {
  if (name === 'play') {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className="item-detail-info__icon">
        <polygon points="6 4 20 12 6 20 6 4" />
      </svg>
    )
  }
  if (name === 'favorite') {
    return (
      <svg
        viewBox="0 0 24 24"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="item-detail-info__icon"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l7.78-7.78a5.5 5.5 0 0 0 1.06-8.84z" />
      </svg>
    )
  }
  if (name === 'check') {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="item-detail-info__icon"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    )
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="item-detail-info__icon"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  )
}
