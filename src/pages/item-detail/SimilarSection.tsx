import type { BaseItemDto } from '@/api/types'
import { HorizontalRow } from '@/components/ui/HorizontalRow'

/**
 * Movie / Trailer / Video / MusicVideo 类型的相似内容横向列表
 */
export function SimilarSection({
  items,
  loading,
}: {
  items: BaseItemDto[]
  loading: boolean
}) {
  return (
    <section className="pt-4">
      <HorizontalRow
        title="相似内容"
        items={items}
        loading={loading}
        shape="poster"
        size="md"
      />
    </section>
  )
}
