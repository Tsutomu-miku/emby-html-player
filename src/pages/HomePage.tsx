import { useAuthStore } from '@/store/auth'
import { getResumeItems, getNextUp, getLatestItems, getRecommendations } from '@/api/library'
import type { BaseItemDto, QueryResult } from '@/api/types'
import { useAsync } from '@/hooks/useAsync'
import { HorizontalRow } from '@/components/ui/HorizontalRow'

interface RecommendationCategory {
  baselineItemName?: string
  baselineItemId?: string
  categoryId?: number
  items: BaseItemDto[]
  recommendationType?: string
}

/**
 * 首页：欢迎语 + 四个异步区块（继续观看 / 下一集 / 最近添加 / 推荐行）。
 */
export function HomePage() {
  const userId = useAuthStore((s) => s.userId)
  const user = useAuthStore((s) => s.user)

  // 继续观看
  const resume = useAsync<QueryResult<BaseItemDto>>(
    async () => (userId ? getResumeItems(userId, { limit: 16 }) : { items: [], totalRecordCount: 0 }),
    [userId],
  )

  // 下一集
  const nextUp = useAsync<QueryResult<BaseItemDto>>(
    async () => (userId ? getNextUp(userId, { limit: 16 }) : { items: [], totalRecordCount: 0 }),
    [userId],
  )

  // 最近添加（返回数组，包一层 QueryResult 风格）
  const latest = useAsync<BaseItemDto[]>(
    async () => (userId ? getLatestItems(userId) : []),
    [userId],
  )

  // 推荐
  const recs = useAsync<RecommendationCategory[]>(
    async () => (userId ? getRecommendations(userId, 6, 10) : []),
    [userId],
  )

  // 捕获错误不冒泡
  if (resume.error) console.error('[HomePage] resume failed:', resume.error)
  if (nextUp.error) console.error('[HomePage] nextUp failed:', nextUp.error)
  if (latest.error) console.error('[HomePage] latest failed:', latest.error)
  if (recs.error) console.error('[HomePage] recommendations failed:', recs.error)

  const latestItems = latest.data || []

  return (
    <div className="space-y-8 md:space-y-10">
      {/* 欢迎语 */}
      <header className="space-y-1.5">
        <h1 className="text-2xl md:text-3xl font-bold">
          欢迎回来，{user?.name || '朋友'}
        </h1>
        <p className="text-jelly-muted text-sm md:text-base">今天想看点什么？</p>
      </header>

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

      {/* 最近添加 */}
      <HorizontalRow
        title="最近添加"
        items={latestItems}
        loading={latest.loading}
        shape="poster"
        size="md"
      />

      {/* 推荐：循环渲染多个 HorizontalRow */}
      {(recs.data || []).map((cat, idx) => {
        const title =
          cat.baselineItemName
            ? `${cat.recommendationType || '相似于'}：${cat.baselineItemName}`
            : cat.recommendationType || `推荐 #${idx + 1}`
        return (
          <HorizontalRow
            key={cat.categoryId ?? idx}
            title={title}
            items={cat.items || []}
            loading={false}
            shape="poster"
            size="md"
          />
        )
      })}

      {/* 推荐 loading */}
      {recs.loading && (
        <HorizontalRow
          title="个性化推荐"
          items={[]}
          loading={true}
          shape="poster"
          size="md"
        />
      )}
    </div>
  )
}
