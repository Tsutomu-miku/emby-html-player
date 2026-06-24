/** 占位详情页 */
export function ItemDetailPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl h-48 md:h-72 skeleton" />
      <div className="flex gap-6">
        <div className="w-40 shrink-0 hidden md:block">
          <div className="aspect-[2/3] skeleton rounded-xl overflow-hidden" />
        </div>
        <div className="flex-1 space-y-3">
          <div className="h-8 skeleton w-1/2" />
          <div className="h-4 skeleton w-1/4" />
          <div className="h-4 skeleton" />
          <div className="h-4 skeleton w-5/6" />
          <div className="h-4 skeleton w-2/3" />
          <div className="mt-4 flex gap-3">
            <div className="h-10 w-28 skeleton rounded" />
            <div className="h-10 w-28 skeleton rounded" />
          </div>
        </div>
      </div>
    </div>
  )
}
