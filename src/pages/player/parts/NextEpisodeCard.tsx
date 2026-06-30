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
    <div
      role="dialog"
      aria-label="即将播放下一集"
      className="absolute z-30 bottom-24 right-4 sm:right-6 w-[280px] sm:w-[320px] rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 bg-jelly-card/95 backdrop-blur animate-[fadeIn_.25s_ease-out]"
      style={{ animation: 'fadeIn .25s ease-out' }}
    >
      <div className="relative aspect-video">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
        ) : null}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-jelly-card to-transparent pointer-events-none" />
        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[11px] font-medium">
          {countdown}s 后自动播放
        </div>
      </div>
      <div className="p-3 space-y-2">
        <div className="text-[11px] text-jelly-muted">{seasonEpisode}</div>
        <div className="text-white font-semibold text-sm line-clamp-1">
          {nextEpisode.name ?? '下一集'}
        </div>
        <div className="text-xs text-jelly-muted line-clamp-2 leading-relaxed min-h-[2.5em]">
          {nextEpisode.overview || '暂无简介'}
        </div>
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            className="btn !py-1.5 text-xs flex-1"
            onClick={onPlayNow}
          >
            立即播放
          </button>
          <button
            type="button"
            className="btn-ghost !py-1.5 text-xs flex-1"
            onClick={onCancel}
          >
            取消
          </button>
        </div>
      </div>
    </div>
  )
}
