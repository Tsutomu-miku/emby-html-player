import type { BaseItemDto } from '@/api/types'
import { posterUrl, backdropUrl, thumbUrl } from '@/api/images'

export interface NextEpisodeCardProps {
  nextEpisode: BaseItemDto
  countdown: number
  beforeEnded: boolean
  autoplayCancelled: boolean
  onPlayNow: () => void
  onCancel: () => void
}

export function NextEpisodeCard({
  nextEpisode,
  countdown,
  beforeEnded,
  autoplayCancelled,
  onPlayNow,
  onCancel,
}: NextEpisodeCardProps) {
  if (!beforeEnded || autoplayCancelled) return null

  const imageSrc =
    thumbUrl(nextEpisode, { width: 640 }) ||
    backdropUrl(nextEpisode, { width: 640 }) ||
    posterUrl(nextEpisode, { width: 640 })

  const seasonEpisode =
    nextEpisode.parentIndexNumber !== null && nextEpisode.indexNumber !== null
      ? `S${String(nextEpisode.parentIndexNumber).padStart(2, '0')}E${String(nextEpisode.indexNumber).padStart(2, '0')}`
      : ''

  return (
    <section className="next-episode-card" aria-label="即将播放下一集">
      <div className="next-episode-card__image">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt=""
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
        ) : null}
        <div className="next-episode-card__countdown">
          {countdown}s 后自动播放
        </div>
      </div>
      <div className="next-episode-card__body">
        <div className="next-episode-card__label">{seasonEpisode || '下一集'}</div>
        <h2>
          {nextEpisode.name ?? '下一集'}
        </h2>
        <p>
          {nextEpisode.overview || '暂无简介'}
        </p>
      </div>
      <div className="next-episode-card__actions">
        <button
          type="button"
          className="btn"
          onClick={onPlayNow}
        >
          立即播放
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={onCancel}
        >
          取消
        </button>
      </div>
    </section>
  )
}
