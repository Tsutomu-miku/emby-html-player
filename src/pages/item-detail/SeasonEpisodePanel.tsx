import type { BaseItemDto, ItemType } from '@/api/types'
import { SeasonPicker } from '@/components/ui/SeasonPicker'
import { EpisodeRow } from '@/components/ui/EpisodeRow'
import { ErrorState } from '@/components/ui/ErrorState'

/**
 * 按类型渲染的季 & 剧集面板：
 *  - Series: 季选择器 + EpisodeList
 *  - Season: EpisodeList（无选择器，标题"本季剧集"）
 *  - Episode: 同季其它集数列表
 */
export function SeasonEpisodePanel({
  type,
  item,
  seasons,
  activeSeasonId,
  onSeasonChange,
  episodes,
  episodesLoading,
  episodesError,
  siblingEpisodes,
}: {
  type: ItemType | undefined
  item: BaseItemDto
  seasons: BaseItemDto[]
  activeSeasonId: string | undefined
  onSeasonChange: (id: string | undefined) => void
  episodes: BaseItemDto[]
  episodesLoading: boolean
  episodesError?: Error
  siblingEpisodes: BaseItemDto[]
}) {
  return (
    <>
      {/* Series：季选择器 + 剧集列表 */}
      {type === 'Series' && seasons.length > 0 && (
        <section className="space-y-4 pt-4">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-lg font-semibold">剧集</h2>
          </div>
          <SeasonPicker
            seasons={seasons}
            activeId={activeSeasonId}
            onChange={onSeasonChange}
          />
          <EpisodeList
            loading={episodesLoading}
            items={episodes}
            error={episodesError}
          />
        </section>
      )}

      {/* Season：季选择器 + 剧集列表 */}
      {type === 'Season' && (
        <section className="space-y-4 pt-4">
          <h2 className="text-lg font-semibold">本季剧集</h2>
          <EpisodeList
            loading={episodesLoading}
            items={episodes}
            error={episodesError}
          />
        </section>
      )}

      {/* Episode：同季其它集数提示 */}
      {type === 'Episode' && siblingEpisodes.length > 1 && (
        <section className="space-y-3 pt-4">
          <h2 className="text-lg font-semibold">本季其它集数</h2>
          <div className="space-y-2">
            {siblingEpisodes
              .filter((e) => e.id !== item.id)
              .slice(0, 12)
              .map((ep) => (
                <EpisodeRow key={ep.id} episode={ep} showSeasonLabel={false} />
              ))}
          </div>
        </section>
      )}
    </>
  )
}

/** 剧集列表：loading skeleton + EpisodeRow + error */
export function EpisodeList({
  loading,
  items,
  error,
}: {
  loading: boolean
  items: BaseItemDto[]
  error?: Error
}) {
  if (error && items.length === 0) {
    return (
      <ErrorState title="加载剧集失败" message={error.message} className="max-w-2xl mx-auto" />
    )
  }
  if (loading && items.length === 0) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-[110px_1fr] sm:grid-cols-[160px_1fr] gap-3 sm:gap-4 p-2 sm:p-3"
          >
            <div className="aspect-video skeleton rounded" />
            <div className="space-y-2">
              <div className="h-4 skeleton w-2/5 rounded" />
              <div className="h-3 skeleton w-1/5 rounded" />
              <div className="h-3 skeleton w-full rounded" />
              <div className="h-3 skeleton w-5/6 rounded" />
            </div>
          </div>
        ))}
      </div>
    )
  }
  if (items.length === 0) {
    return <div className="py-10 text-center text-jelly-muted text-sm">暂无剧集</div>
  }
  return (
    <div className="space-y-2">
      {items.map((ep) => (
        <EpisodeRow key={ep.id} episode={ep} />
      ))}
    </div>
  )
}
