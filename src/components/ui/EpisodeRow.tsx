import { useNavigate } from 'react-router-dom'
import type { BaseItemDto } from '@/api/types'
import { thumbUrl, posterUrl } from '@/api/images'
import { ticksToSeconds, formatDurationShort, formatDate } from '@/utils/time'
import { cx } from '@/utils'

export interface EpisodeRowProps {
  episode: BaseItemDto
  showSeasonLabel?: boolean
}

/**
 * 单集行：左侧缩略图（Thumb 优先，否则 Poster aspect-video），
 * 右侧显示集号、标题、首播日期、时长、简介、进度；含播放按钮。
 */
export function EpisodeRow({ episode, showSeasonLabel = false }: EpisodeRowProps) {
  const navigate = useNavigate()
  const thumbSrc =
    thumbUrl(episode, { quality: 60, placeholderOnMissing: true }) ||
    posterUrl(episode, { quality: 60, placeholderOnMissing: true })

  const position = episode.userData?.playbackPositionTicks ?? 0
  const runTime = episode.runTimeTicks ?? 0
  const progress = position > 0 && runTime > 0 ? (position / runTime) * 100 : 0
  const played = episode.userData?.played === true

  const epNum =
    episode.indexNumber !== undefined && episode.indexNumber !== null
      ? `第 ${episode.indexNumber} 集`
      : ''

  const seasonLabel =
    showSeasonLabel && episode.parentIndexNumber !== undefined
      ? `S${String(episode.parentIndexNumber).padStart(2, '0')} · `
      : ''

  return (
    <div
      className={cx(
        'group grid grid-cols-[110px_1fr] sm:grid-cols-[160px_1fr] gap-3 sm:gap-4 p-2 sm:p-3 rounded-lg',
        'bg-jelly-card hover:bg-jelly-hover transition-colors cursor-pointer',
      )}
      onClick={() => { void navigate(`/player/${episode.id}`) }}
    >
      {/* 缩略图 */}
      <div className="relative aspect-video rounded overflow-hidden bg-jelly-panel shrink-0">
        <img
          src={thumbSrc}
          alt={episode.name || ''}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.onerror = null
            e.currentTarget.src =
              "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='%231a1c22'/></svg>"
          }}
        />

        {/* 播放按钮浮层 */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            void navigate(`/player/${episode.id}`)
          }}
          className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="播放"
        >
          <span className="w-12 h-12 rounded-full bg-black/70 backdrop-blur-sm flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white translate-x-[1px]">
              <polygon points="6 4 20 12 6 20 6 4" />
            </svg>
          </span>
        </button>

        {/* 进度条 */}
        {progress > 0 && !played && (
          <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-black/40">
            <div
              className="h-full bg-jelly-accent"
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
        )}

        {/* 时长 */}
        {episode.runTimeTicks && (
          <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/70 text-[10px] text-white">
            {formatDurationShort(ticksToSeconds(episode.runTimeTicks))}
          </span>
        )}

        {/* 已看标记 */}
        {played && (
          <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-jelly-accent text-white flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
        )}
      </div>

      {/* 右侧信息 */}
      <div className="min-w-0 flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-jelly-accent font-medium whitespace-nowrap">
                {seasonLabel}
                {epNum}
              </span>
              {episode.premiereDate && (
                <span className="text-xs text-jelly-muted">{formatDate(episode.premiereDate)}</span>
              )}
            </div>
            <h4 className="mt-0.5 text-sm sm:text-base font-medium text-jelly-text truncate" title={episode.name}>
              {episode.name || '未命名'}
            </h4>
          </div>
        </div>
        {episode.overview && (
          <p className="mt-1.5 text-xs sm:text-sm text-jelly-muted line-clamp-2 sm:line-clamp-3 leading-relaxed">
            {episode.overview}
          </p>
        )}
      </div>
    </div>
  )
}
