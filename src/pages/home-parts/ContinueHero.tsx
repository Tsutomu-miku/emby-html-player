import { Link } from 'react-router-dom'
import type { BaseItemDto } from '@/api/types'
import type { UserView } from '@/api/users'
import { backdropUrl, getImageUrl, thumbUrl } from '@/api/images'
import { cx } from '@/utils'
import { collectionTypeLabel } from '@/components/layout/Sidebar'
import './ContinueHero.scss'

export interface ContinueHeroProps {
  item: BaseItemDto
  sideItems: BaseItemDto[]
  loading?: boolean
}

export function progressPercent(item: BaseItemDto): number {
  const position = item.userData?.playbackPositionTicks ?? 0
  const runTime = item.runTimeTicks ?? 0
  if (position <= 0 || runTime <= 0) return 0
  return Math.min(100, Math.max(0, (position / runTime) * 100))
}

export function episodeSubtitle(item: BaseItemDto): string {
  if (item.type === 'Episode') {
    const season = item.parentIndexNumber ? `S${item.parentIndexNumber}` : ''
    const episode = item.indexNumber ? `E${item.indexNumber}` : ''
    const series = item.seriesName
    const se = [season, episode].filter(Boolean).join(' · ')
    return [se, item.name === series ? '' : item.name].filter(Boolean).join(' · ')
  }
  return item.productionYear ? String(item.productionYear) : ''
}

/**
 * 首页「继续播放」模块：一张大卡 + 右侧 3 张小卡。
 * 模块外需要调用方渲染 <h2>继续播放</h2> 级别的 section 标题。
 */
export function ContinueHero({ item, sideItems, loading = false }: ContinueHeroProps) {
  const image = backdropUrl(item, { quality: 80, placeholderOnMissing: true })
  const progress = progressPercent(item)

  return (
    <section className="continue-hero" aria-busy={loading}>
      <Link to={`/player/${item.id}`} className="continue-hero__feature">
        <img src={image} alt="" className="continue-hero__image" loading="eager" />
        <div className="continue-hero__shade" />
        <div className="continue-hero__content">
          <h3 className="continue-hero__title">{item.name || '未命名'}</h3>
          {episodeSubtitle(item) ? (
            <div className="continue-hero__meta">{episodeSubtitle(item)}</div>
          ) : null}
          <div className="continue-hero__actions">
            <span className="continue-hero__play">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <polygon points="8 5 19 12 8 19 8 5" />
              </svg>
              播放
            </span>
            <span className="continue-hero__more" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <circle cx="5" cy="12" r="2.4" />
                <circle cx="12" cy="12" r="2.4" />
                <circle cx="19" cy="12" r="2.4" />
              </svg>
            </span>
          </div>
        </div>
        {progress > 0 ? (
          <div
            className="continue-hero__progress"
            aria-label={`播放进度 ${Math.round(progress)}%`}
          >
            <span style={{ width: `${progress}%` }} />
          </div>
        ) : null}
      </Link>

      {sideItems.length > 0 ? (
        <ul className="continue-hero__side">
          {sideItems.map((side) => {
            const p = progressPercent(side)
            return (
              <li key={side.id}>
                <Link to={`/player/${side.id}`} className="continue-hero__side-item">
                  <div className="continue-hero__side-thumb">
                    <img
                      src={thumbUrl(side, { quality: 70, placeholderOnMissing: true })}
                      alt=""
                      loading="lazy"
                    />
                    {p > 0 ? (
                      <span className="continue-hero__side-thumb-progress">
                        <span style={{ width: `${p}%` }} />
                      </span>
                    ) : null}
                  </div>
                  <div className="continue-hero__side-copy">
                    <div className="continue-hero__side-title" title={side.seriesName || side.name}>
                      {side.seriesName || side.name || '未命名'}
                    </div>
                    <div className="continue-hero__side-meta">
                      {sideEpisodeMeta(side)}
                    </div>
                    {p > 0 ? (
                      <div className="continue-hero__side-progress">
                        <span style={{ width: `${p}%` }} />
                      </div>
                    ) : null}
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      ) : null}
    </section>
  )
}

function sideEpisodeMeta(item: BaseItemDto): string {
  if (item.type === 'Episode') {
    const season = item.parentIndexNumber ? `S${item.parentIndexNumber}` : ''
    const episode = item.indexNumber ? `E${item.indexNumber}` : ''
    const parts = [season, episode].filter(Boolean)
    if (parts.length === 0 && item.name && item.name !== item.seriesName) return item.name
    if (item.name && item.name !== item.seriesName && parts.length > 0) {
      parts.push(item.name)
    }
    return parts.join(' · ')
  }
  return item.productionYear ? String(item.productionYear) : ''
}

export interface MediaLibraryCardProps {
  view: UserView
  count?: number
  countLoading?: boolean
}

export function MediaLibraryCard({
  view,
  count = 0,
  countLoading = false,
}: MediaLibraryCardProps) {
  const primary = view.imageTags?.['Primary']
  const backdrop = view.imageTags?.['Backdrop']
  const img = primary
    ? getImageUrl(view.id, 'Primary', primary, { quality: 70 })
    : backdrop
      ? getImageUrl(view.id, 'Backdrop', backdrop, { quality: 70 })
      : ''
  return (
    <Link
      to={`/library/${view.id}`}
      className={cx('home-library-card', !img && 'home-library-card--empty')}
    >
      {img ? <img src={img} alt="" loading="lazy" decoding="async" /> : null}
      <div className="home-library-card__shade" />
      <div className="home-library-card__content">
        <div className="home-library-card__main">
          <div className="home-library-card__glyph">
            <LibraryGlyphMini collectionType={view.collectionType} />
          </div>
          <div className="home-library-card__meta">
            <div className="home-library-card__name">{view.name || '未命名'}</div>
            <div className="home-library-card__count">
              {countLoading
                ? '…'
                : count > 0
                  ? count.toLocaleString()
                  : collectionTypeLabel(view.collectionType)}
            </div>
          </div>
        </div>
        <span className="chip home-library-card__chip">
          {collectionTypeLabel(view.collectionType)}
        </span>
      </div>
    </Link>
  )
}

/* Library card glyph — smaller variant tailored to the 40x40 pill. */
function LibraryGlyphMini({ collectionType }: { collectionType?: string }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: 'home-library-card__glyph-svg',
  }
  if (collectionType === 'movies') {
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M7 5v14M17 5v14M3 9h4M17 9h4M3 15h4M17 15h4" />
      </svg>
    )
  }
  if (collectionType === 'tvshows') {
    return (
      <svg {...common}>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="m8 3 4 4 4-4" />
      </svg>
    )
  }
  if (collectionType === 'boxsets') {
    return (
      <svg {...common}>
        <path d="M3 7h18l-1.5 10a2 2 0 0 1-2 1.7H6.5A2 2 0 0 1 4.5 17L3 7Z" />
        <path d="M3 7 12 3l9 4" />
      </svg>
    )
  }
  if (collectionType === 'music') {
    return (
      <svg {...common}>
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <path d="M4 4h10l6 6v10a2 2 0 0 1-2 2H4z" />
      <path d="M14 4v6h6" />
    </svg>
  )
}
