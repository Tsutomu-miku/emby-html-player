import type { BaseItemDto } from '@/api/types'
import { PosterCard } from '@/components/ui/PosterCard'
import { ErrorState } from '@/components/ui/ErrorState'

/**
 * BoxSet / Folder / CollectionFolder / AggregateFolder 类型的子项网格
 */
export function ChildrenGrid({
  type,
  items,
  loading,
  error,
}: {
  type: string | undefined
  items: BaseItemDto[]
  loading: boolean
  error?: Error
}) {
  const gridClasses =
    'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6'

  return (
    <section className="space-y-3 pt-4">
      <h2 className="text-lg font-semibold">
        {type === 'BoxSet' ? '合集内容' : '目录内容'}
      </h2>
      {loading && items.length === 0 ? (
        <div className={gridClasses}>
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] skeleton rounded-lg" />
          ))}
        </div>
      ) : (
        <div className={gridClasses}>
          {items.map((child) => (
            <PosterCard key={child.id} item={child} size="md" shape="poster" showPlayButton />
          ))}
        </div>
      )}
      {error && (
        <ErrorState
          title="加载子项失败"
          message={error.message}
        />
      )}
      {!loading && items.length === 0 && !error && (
        <div className="py-10 text-center text-jelly-muted text-sm">暂无内容</div>
      )}
    </section>
  )
}
