import { Link } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { getResumeItems, getNextUp, getLatestItems, getUserViews } from '@/api'
import type { BaseItemDto, QueryResult } from '@/api/types'
import type { UserView } from '@/api/users'
import { useAsync } from '@/hooks/useAsync'
import { HorizontalRow } from '@/components/ui/HorizontalRow'
import { collectionTypeLabel } from '@/components/layout/Sidebar'
import { getImageUrl } from '@/api/images'
import { cx } from '@/utils'

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

  return (
    <div className="space-y-8 md:space-y-10">
      <header className="space-y-1.5">
        <h1 className="text-2xl md:text-3xl font-bold">
          欢迎回来，{user?.name || '朋友'}
        </h1>
        <p className="text-jelly-muted text-sm md:text-base">今天想看点什么？</p>
      </header>

      {/* 媒体库网格 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-jelly-text">媒体库</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {viewsAsync.loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="aspect-video rounded-xl skeleton" />
              ))
            : views.map((v) => <MediaLibraryCard key={v.id} view={v} />)}
        </div>
      </section>

      {/* 继续观看 —— 点击直接播放 */}
      <HorizontalRow
        title="继续观看"
        items={resume.data?.items || []}
        loading={resume.loading}
        shape="backdrop"
        itemClickMode="play"
        size="md"
      />

      {/* 下一集 */}
      <HorizontalRow
        title="下一集"
        items={nextUp.data?.items || []}
        loading={nextUp.loading}
        shape="backdrop"
        size="md"
      />

      {/* 每个媒体库的最新添加 */}
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

/** 媒体库入口卡片：backdrop 比例，叠库名 + 类型 chip */
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
        'group relative block rounded-xl overflow-hidden bg-jelly-card',
        'aspect-video transition-transform hover:-translate-y-0.5 hover:shadow-lg',
      )}
    >
      {img ? (
        <img
          src={img}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-105"
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
      <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between gap-2">
        <div className="font-semibold text-white text-sm md:text-base truncate drop-shadow">
          {view.name || '未命名'}
        </div>
        <span className="chip shrink-0">{collectionTypeLabel(view.collectionType)}</span>
      </div>
    </Link>
  )
}
