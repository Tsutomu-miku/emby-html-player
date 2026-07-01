import { useNavigate } from 'react-router-dom'
import { posterUrl, backdropUrl, thumbUrl } from '@/api/images'
import type { BaseItemDto } from '@/api/types'
import { cx } from '@/utils'

export interface AdjacentEpisodesProps {
  item: BaseItemDto
  episodesLoading: boolean
  adjacentEpisodes: BaseItemDto[]
}

export function AdjacentEpisodes({ item, episodesLoading, adjacentEpisodes }: AdjacentEpisodesProps) {
  const navigate = useNavigate()

  if (item.type !== 'Episode' || (!episodesLoading && adjacentEpisodes.length === 0)) return null

  return (
    <section className="player-episodes">
      <header className="player-episodes__header">
        <h2>
          {item.seasonName || (item.parentIndexNumber !== null ? `Season ${item.parentIndexNumber}` : '本季剧集')}
        </h2>
      </header>
      {episodesLoading ? (
        <div className="player-episodes__scroller">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="player-episode-card">
              <div className="player-episode-card__image skeleton" />
              <div className="player-episode-card__body">
                <div className="skeleton h-4 w-1/3 rounded" />
                <div className="skeleton h-4 w-full rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="player-episodes__scroller">
          {adjacentEpisodes.map((ep) => {
            const isCurrent = ep.id === item.id
            return (
              <button
                key={ep.id}
                type="button"
                onClick={() => { void navigate(`/player/${ep.id}`) }}
                className={cx(
                  'player-episode-card',
                  isCurrent && 'player-episode-card--current',
                )}
              >
                <div className="player-episode-card__image">
                  <img
                    src={
                      thumbUrl(ep, { width: 480 }) ||
                      backdropUrl(ep, { width: 480 }) ||
                      posterUrl(ep, { width: 480 })
                    }
                    alt=""
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                  {ep.indexNumber !== null ? (
                    <span className="player-episode-card__badge">
                      E{String(ep.indexNumber).padStart(2, '0')}
                    </span>
                  ) : null}
                </div>
                <div className="player-episode-card__body">
                  <h3>
                    {ep.name ?? `第 ${ep.indexNumber ?? '?'} 集`}
                  </h3>
                  <p>
                    {ep.overview || '暂无简介'}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
