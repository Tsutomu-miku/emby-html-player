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
    <div>
      <h2 className="text-lg font-semibold text-white mb-3">
        {item.seasonName || (item.parentIndexNumber !== null ? `Season ${item.parentIndexNumber}` : '本季剧集')}
      </h2>
      {episodesLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card">
              <div className="aspect-video skeleton rounded-none" />
              <div className="p-3 space-y-2">
                <div className="skeleton h-4 w-1/3 rounded" />
                <div className="skeleton h-4 w-full rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {adjacentEpisodes.map((ep) => {
            const isCurrent = ep.id === item.id
            return (
              <button
                key={ep.id}
                type="button"
                onClick={() => { void navigate(`/player/${ep.id}`) }}
                className={cx(
                  'card text-left group',
                  isCurrent ? 'ring-2 ring-jelly-accent' : '',
                )}
              >
                <div className="aspect-video bg-jelly-hover overflow-hidden relative">
                  <img
                    src={
                      thumbUrl(ep, { width: 480 }) ||
                      backdropUrl(ep, { width: 480 }) ||
                      posterUrl(ep, { width: 480 })
                    }
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                  {ep.indexNumber !== null ? (
                    <span className="absolute top-1 left-1 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-black/70 text-white">
                      E{String(ep.indexNumber).padStart(2, '0')}
                    </span>
                  ) : null}
                </div>
                <div className="p-3 space-y-1">
                  <div className="text-sm font-medium text-white line-clamp-1">
                    {ep.name ?? `第 ${ep.indexNumber ?? '?'} 集`}
                  </div>
                  <div className="text-xs text-jelly-muted line-clamp-2 leading-snug min-h-[2.2em]">
                    {ep.overview || '暂无简介'}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
