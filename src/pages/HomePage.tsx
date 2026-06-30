import { Link } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { getResumeItems, getNextUp, getLatestItems, getUserViews } from '@/api'
import type { BaseItemDto, QueryResult } from '@/api/types'
import type { UserView } from '@/api/users'
import { useAsync } from '@/hooks/useAsync'
import { HorizontalRow } from '@/components/ui/HorizontalRow'
import { collectionTypeLabel } from '@/components/layout/Sidebar'
import { backdropUrl, getImageUrl, thumbUrl } from '@/api/images'
import { PageSection } from '@/components/ui/primitives'
import { cx } from '@/utils'
import './HomePage.scss'

/**
 * 首页：
 *  1. 媒体库入口网格（动画电影 / 国漫 / 美漫 …，按用户实际库列表渲染）
 *  2. 继续观看
 *  3. 下一集
 *  4. 每个媒体库的「最新 · {库名}」横向行
 *
 * 不再使用 /Movies/Recommendations —— 该接口返回的 RecommendationType 是 PascalCase
 * 内部分类标识符，直接拼到 UI 会出现「HasActorFromRecentlyPlayed：xxx」等不可读标题。
 */
export function HomePage() {
  const userId = useAuthStore((s) => s.userId)
  const user = useAuthStore((s) => s.user)

  const resume = useAsync<QueryResult<BaseItemDto>>(
    async () => (userId ? getResumeItems(userId, { limit: 16 }) : { items: [], totalRecordCount: 0 }),
    [userId],
  )
  const nextUp = useAsync<QueryResult<BaseItemDto>>(
    async () => (userId ? getNextUp(userId, { limit: 16 }) : { items: [], totalRecordCount: 0 }),
    [userId],
  )
  const viewsAsync = useAsync(
    async () =>
      userId
        ? getUserViews(userId)
        : { items: [] as UserView[], totalRecordCount: 0 },
    [userId],
  )

  // 媒体库列表拿到后，并发拉每个库的「最新」
  const viewIds = viewsAsync.data?.items?.map((v) => v.id).join(',') ?? ''
  const latest = useAsync<Record<string, BaseItemDto[]>>(
    async () => {
      if (!userId || !viewIds) return {}
      const views = viewsAsync.data?.items ?? []
      if (!views.length) return {}
      const entries = await Promise.all(
        views.map(async (v) => {
          const items = await getLatestItems(userId, v.id, { limit: 16 }).catch(
            () => [] as BaseItemDto[],
          )
          return [v.id, items] as const
        }),
      )
      const map: Record<string, BaseItemDto[]> = {}
      for (const [id, items] of entries) map[id] = items
      return map
    },
    [viewIds],
  )

  if (resume.error) console.error('[HomePage] resume failed:', resume.error)
  if (nextUp.error) console.error('[HomePage] nextUp failed:', nextUp.error)
  if (viewsAsync.error) console.error('[HomePage] views failed:', viewsAsync.error)
  if (latest.error) console.error('[HomePage] latest failed:', latest.error)

  const views = viewsAsync.data?.items || []
  const latestMap = latest.data || {}
  const resumeItems = resume.data?.items || []
  const heroItem = resumeItems[0]

  return (
    <div className="home-page">
      <header className="home-page__header">
        <h1 className="home-page__title">
          欢迎回来，{user?.name || '朋友'}
        </h1>
        <p className="home-page__subtitle">今天想看点什么？</p>
      </header>

      {resume.loading && !heroItem ? (
        <div className="home-hero home-hero--loading skeleton" />
      ) : heroItem ? (
        <ContinueHero item={heroItem} sideItems={resumeItems.slice(1, 4)} />
      ) : null}

      <PageSection title="媒体库" className="home-page__libraries">
        <div className="home-page__library-grid">
          {viewsAsync.loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="home-library-card home-library-card--loading skeleton" />
              ))
            : views.map((v) => <MediaLibraryCard key={v.id} view={v} />)}
        </div>
      </PageSection>

      <HorizontalRow
        title="继续观看"
        items={resumeItems.slice(heroItem ? 1 : 0)}
        loading={resume.loading}
        shape="backdrop"
        itemClickMode="play"
        size="md"
      />

      <HorizontalRow
        title="下一集"
        items={nextUp.data?.items || []}
        loading={nextUp.loading}
        shape="backdrop"
        size="md"
      />
      {views.map((v) => (
        <HorizontalRow
          key={v.id}
          title={`最新 · ${v.name}`}
          items={latestMap[v.id] || []}
          loading={!latest.data}
          shape="poster"
          size="md"
          seeMoreHref={`/library/${v.id}`}
        />
      ))}
    </div>
  )
}

function ContinueHero({
  item,
  sideItems,
}: {
  item: BaseItemDto
  sideItems: BaseItemDto[]
}) {
  const image = backdropUrl(item, { quality: 76, placeholderOnMissing: true })
  const progress = progressPercent(item)
  const subtitle = episodeSubtitle(item)

  return (
    <section className="home-hero">
      <Link to={`/player/${item.id}`} className="home-hero__feature">
        <img src={image} alt="" className="home-hero__image" loading="eager" />
        <div className="home-hero__shade" />
        <div className="home-hero__content">
          <div className="home-hero__eyebrow">继续播放</div>
          <h2 className="home-hero__title">{item.name || '未命名'}</h2>
          {subtitle ? <div className="home-hero__meta">{subtitle}</div> : null}
          {progress > 0 ? (
            <div className="home-hero__progress" aria-label={`播放进度 ${Math.round(progress)}%`}>
              <span style={{ width: `${progress}%` }} />
            </div>
          ) : null}
          <div className="home-hero__actions">
            <span className="home-hero__play">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <polygon points="8 5 19 12 8 19 8 5" />
              </svg>
              播放
            </span>
          </div>
        </div>
      </Link>

      {sideItems.length > 0 ? (
        <div className="home-hero__side">
          {sideItems.map((side) => (
            <Link key={side.id} to={`/player/${side.id}`} className="home-hero__side-item">
              <img
                src={thumbUrl(side, { quality: 60, placeholderOnMissing: true })}
                alt=""
                loading="lazy"
              />
              <div className="home-hero__side-copy">
                <div className="home-hero__side-title">{side.name || '未命名'}</div>
                <div className="home-hero__side-meta">{episodeSubtitle(side)}</div>
                <div className="home-hero__side-progress">
                  <span style={{ width: `${progressPercent(side)}%` }} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  )
}

function MediaLibraryCard({ view }: { view: UserView }) {
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
      className={cx(
        'home-library-card',
        !img && 'home-library-card--empty',
      )}
    >
      {img ? (
        <img
          src={img}
          alt=""
          loading="lazy"
          decoding="async"
        />
      ) : null}
      <div className="home-library-card__shade" />
      <div className="home-library-card__content">
        <div className="home-library-card__name">
          {view.name || '未命名'}
        </div>
        <span className="chip home-library-card__chip">{collectionTypeLabel(view.collectionType)}</span>
      </div>
    </Link>
  )
}

function progressPercent(item: BaseItemDto): number {
  const position = item.userData?.playbackPositionTicks ?? 0
  const runTime = item.runTimeTicks ?? 0
  if (position <= 0 || runTime <= 0) return 0
  return Math.min(100, Math.max(0, (position / runTime) * 100))
}

function episodeSubtitle(item: BaseItemDto): string {
  if (item.type === 'Episode') {
    const season = item.parentIndexNumber ? `S${item.parentIndexNumber}` : ''
    const episode = item.indexNumber ? `E${item.indexNumber}` : ''
    return [season, episode].filter(Boolean).join(' · ')
  }
  return item.productionYear ? String(item.productionYear) : ''
}
