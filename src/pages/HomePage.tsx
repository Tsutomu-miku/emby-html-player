import { useAuthStore } from '@/store/auth'
import {
  getResumeItems,
  getNextUp,
  getLatestItems,
  getUserViews,
  getItems,
} from '@/api'
import type { BaseItemDto, QueryResult } from '@/api/types'
import type { UserView } from '@/api/users'
import { useAsync } from '@/hooks/useAsync'
import { HorizontalRow } from '@/components/ui/HorizontalRow'
import { PageSection } from '@/components/ui/primitives'
import {
  ContinueHero,
  MediaLibraryCard,
} from '@/pages/home-parts/ContinueHero'
import { HeroWallpaper } from '@/pages/home-parts/HeroWallpaper'
import './HomePage.scss'

/* Home page layout.
 *
 * Section order (top to bottom):
 *   1. Continue-watching hero (feature card + side list)
 *   2. Media library entry grid
 *   3. "Next up" horizontal row
 *   4. One "Latest in {library}" row per user library
 *
 * Data fetching is split into independent useAsync calls so that the hero and
 * library cards can paint as soon as their respective payloads land.
 */
export function HomePage() {
  const userId = useAuthStore((s) => s.userId)
  const user = useAuthStore((s) => s.user)

  const resume = useAsync<QueryResult<BaseItemDto>>(
    async () =>
      userId
        ? getResumeItems(userId, { limit: 16 })
        : { items: [], totalRecordCount: 0 },
    [userId],
  )
  const nextUp = useAsync<QueryResult<BaseItemDto>>(
    async () =>
      userId
        ? getNextUp(userId, { limit: 16 })
        : { items: [], totalRecordCount: 0 },
    [userId],
  )
  const viewsAsync = useAsync(
    async () =>
      userId
        ? getUserViews(userId)
        : { items: [] as UserView[], totalRecordCount: 0 },
    [userId],
  )

  const viewIds = viewsAsync.data?.items?.map((v) => v.id).join(',') ?? ''

  // Item counts per library — shown below the library card name.
  const countsAsync = useAsync<Record<string, number>>(
    async () => fetchLibraryCounts(userId, viewIds, viewsAsync.data?.items),
    [viewIds],
  )

  // Per-library "latest items" — rendered as one HorizontalRow per library.
  const latest = useAsync<Record<string, BaseItemDto[]>>(
    async () => fetchLatestPerLibrary(userId, viewIds, viewsAsync.data?.items),
    [viewIds],
  )

  if (resume.error) console.error('[HomePage] resume failed:', resume.error)
  if (nextUp.error) console.error('[HomePage] nextUp failed:', nextUp.error)
  if (viewsAsync.error) console.error('[HomePage] views failed:', viewsAsync.error)
  if (latest.error) console.error('[HomePage] latest failed:', latest.error)
  if (countsAsync.error)
    console.error('[HomePage] counts failed:', countsAsync.error)

  const views = viewsAsync.data?.items || []
  const latestMap = latest.data || {}
  const countsMap = countsAsync.data || {}
  const resumeItems = resume.data?.items || []
  const heroItem = resumeItems[0]

  // Accessing user avoids unused-store warnings if the header is re-enabled.
  void user

  return (
    <div className="home-page">
      <HeroWallpaper item={heroItem} />

      <section className="home-page__section home-page__section--top">
        <h2 className="home-page__section-title">继续播放</h2>
        {resume.loading && !heroItem ? (
          <div className="continue-hero continue-hero--loading skeleton" />
        ) : heroItem ? (
          <ContinueHero
            item={heroItem}
            sideItems={resumeItems.slice(1, 4)}
            loading={resume.loading}
          />
        ) : null}
      </section>

      <PageSection title="媒体库" className="home-page__libraries">
        <div className="home-page__library-grid">
          {viewsAsync.loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="home-library-card home-library-card--loading skeleton"
                />
              ))
            : views.map((v) => (
                <MediaLibraryCard
                  key={v.id}
                  view={v}
                  count={countsMap[v.id] ?? 0}
                  countLoading={!countsAsync.data}
                />
              ))}
        </div>
      </PageSection>

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

/* ----------------------------- helpers ----------------------------- */

async function fetchLibraryCounts(
  userId: string | undefined,
  viewIds: string,
  views: UserView[] | undefined,
): Promise<Record<string, number>> {
  if (!userId || !viewIds || !views?.length) return {}
  const entries = await Promise.all(
    views.map(async (v) => {
      const params: Parameters<typeof getItems>[1] = {
        parentId: v.id,
        limit: 0,
        enableTotalRecordCount: true,
      }
      const ct = v.collectionType
      if (ct === 'movies') params.includeItemTypes = 'Movie,Trailer'
      else if (ct === 'tvshows') params.includeItemTypes = 'Series'
      else if (ct === 'music') params.includeItemTypes = 'MusicAlbum,MusicArtist,Audio'
      else if (ct === 'boxsets') params.includeItemTypes = 'BoxSet'
      else if (ct === 'books') params.includeItemTypes = 'Book'
      else if (ct === 'photos') params.includeItemTypes = 'PhotoAlbum,Photo'
      else if (ct === 'playlists') params.includeItemTypes = 'Playlist'
      const r = await getItems(userId, params).catch(() => null)
      return [v.id, r?.totalRecordCount ?? 0] as const
    }),
  )
  return Object.fromEntries(entries)
}

async function fetchLatestPerLibrary(
  userId: string | undefined,
  viewIds: string,
  views: UserView[] | undefined,
): Promise<Record<string, BaseItemDto[]>> {
  if (!userId || !viewIds || !views?.length) return {}
  const entries = await Promise.all(
    views.map(async (v) => {
      const items = await getLatestItems(userId, v.id, { limit: 16 }).catch(
        () => [] as BaseItemDto[],
      )
      return [v.id, items] as const
    }),
  )
  return Object.fromEntries(entries)
}
