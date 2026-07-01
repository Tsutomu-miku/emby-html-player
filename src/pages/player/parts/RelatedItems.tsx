import type { BaseItemDto } from '@/api/types'
import { HorizontalRow } from '@/components/ui/HorizontalRow'

export function RelatedItems({
  error,
  items,
  loading,
}: {
  error: Error | null
  items: BaseItemDto[]
  loading: boolean
}) {
  if (error) {
    return (
      <section className="player-related player-related--error">
        <h2>相似内容</h2>
        <p>相似内容加载失败：{error.message}</p>
      </section>
    )
  }

  return (
    <HorizontalRow
      title="相似内容"
      items={items}
      loading={loading}
      shape="poster"
      size="md"
      className="player-related"
    />
  )
}
