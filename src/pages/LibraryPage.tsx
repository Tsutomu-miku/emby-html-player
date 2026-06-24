import { Link } from 'react-router-dom'

/** 占位媒体库列表页 */
export function LibraryPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">媒体库</h1>
        <p className="text-jelly-muted text-sm">该页面会在并行任务中填充网格、筛选与搜索。</p>
      </header>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 18 }).map((_, i) => (
          <Link to="#" key={i} className="card block">
            <div className="aspect-[2/3] skeleton" />
            <div className="p-3">
              <div className="h-4 skeleton" />
              <div className="mt-2 h-3 w-1/2 skeleton" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
