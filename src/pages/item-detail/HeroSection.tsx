import type { BaseItemDto } from '@/api/types'
import { ticksToSeconds, formatDurationShort } from '@/utils/time'

/**
 * Hero 区：backdrop + 渐变覆盖 + 右下 logo/标题/chips/tagline 浮层
 */
export function HeroSection({
  item,
  backdropSrc,
  logoSrc,
}: {
  item: BaseItemDto
  backdropSrc: string
  logoSrc?: string
}) {
  // Chips (year + duration + rating + genres)
  const chips: React.ReactNode[] = []
  if (item.productionYear) chips.push(<span key="y" className="chip">{item.productionYear}</span>)
  if (item.runTimeTicks) {
    chips.push(
      <span key="d" className="chip">
        {formatDurationShort(ticksToSeconds(item.runTimeTicks))}
      </span>,
    )
  }
  const rating = item.communityRating
  if (rating) {
    chips.push(
      <span key="r" className="chip">
        {'\u2B50'} {rating.toFixed(1)}
      </span>,
    )
  }
  ;(item.genres || []).slice(0, 3).forEach((g) => chips.push(<span key={`g-${g}`} className="chip">{g}</span>))

  // Hero title（Episode 显示系列名 + 本集标题）
  const type = item.type
  const heroTitle =
    type === 'Episode' && item.seriesName
      ? item.name || `第 ${item.indexNumber ?? 0} 集`
      : item.name || '未命名'

  return (
    <div className="relative rounded-2xl overflow-hidden">
      <div className="relative h-80 md:h-[420px] w-full">
        <img
          src={backdropSrc}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.onerror = null
            e.currentTarget.style.visibility = 'hidden'
          }}
        />
        {/* 渐变覆盖层 */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-jelly-bg" />
        <div className="absolute inset-0 bg-gradient-to-r from-jelly-bg/60 via-transparent to-transparent" />

        {/* 右下 logo/标题浮层 */}
        <div className="absolute bottom-4 left-4 right-4 md:bottom-8 md:left-8 md:right-8 md:pl-64 md:pl-72">
          {logoSrc ? (
            <img
              src={logoSrc}
              alt=""
              className="max-h-24 md:max-h-32 w-auto max-w-full object-contain drop-shadow-lg"
              onError={(e) => {
                e.currentTarget.onerror = null
                e.currentTarget.style.display = 'none'
              }}
            />
          ) : (
            <div>
              {type === 'Episode' && item.seriesName && (
                <div className="text-sm md:text-base text-jelly-muted mb-1">
                  {item.seriesName}
                  {item.parentIndexNumber !== null && item.parentIndexNumber !== undefined &&
                    ` \u00B7 第 ${item.parentIndexNumber} 季`}
                  {item.indexNumber !== null && item.indexNumber !== undefined &&
                    ` \u00B7 第 ${item.indexNumber} 集`}
                </div>
              )}
              <h1 className="text-2xl md:text-4xl font-bold text-white drop-shadow-md">
                {heroTitle}
              </h1>
            </div>
          )}
          {item.originalTitle && item.originalTitle !== item.name && (
            <div className="text-sm md:text-base text-jelly-muted mt-1 italic hidden sm:block">
              {item.originalTitle}
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">{chips}</div>
          {item.tagline && (
            <p className="mt-2 text-sm md:text-base italic text-jelly-muted line-clamp-2">
              {item.tagline}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
