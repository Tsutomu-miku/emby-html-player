import { useNavigate } from 'react-router-dom'
import type { BaseItemDto } from '@/api/types'
import { thumbUrl, posterUrl } from '@/api/images'
import { ticksToSeconds, formatDurationShort, formatDate } from '@/utils/time'
import { cx } from '@/utils'
import './EpisodeRow.scss'

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
        'episode-row',
        played && 'episode-row--played',
      )}
      onClick={() => { void navigate(`/player/${episode.id}`) }}
    >
      <div className="episode-row__thumb">
        <img
          src={thumbSrc}
          alt={episode.name || ''}
          loading="lazy"
          decoding="async"
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
          className="episode-row__play"
          aria-label="播放"
        >
          <span>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <polygon points="6 4 20 12 6 20 6 4" />
            </svg>
          </span>
        </button>

        {progress > 0 && !played && (
          <div className="episode-row__progress">
            <div
              className="episode-row__progress-bar"
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
        )}

        {episode.runTimeTicks && (
          <span className="episode-row__duration">
            {formatDurationShort(ticksToSeconds(episode.runTimeTicks))}
          </span>
        )}

        {played && (
          <span className="episode-row__played">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
        )}
      </div>

      <div className="episode-row__body">
        <div className="episode-row__head">
          <div className="episode-row__meta">
            <span>
              {seasonLabel}
              {epNum}
            </span>
            {episode.premiereDate && (
              <span>{formatDate(episode.premiereDate)}</span>
            )}
          </div>
          <h4 title={episode.name}>
            {episode.name || '未命名'}
          </h4>
        </div>
        {episode.overview && (
          <p>
            {episode.overview}
          </p>
        )}
      </div>
    </div>
  )
}
