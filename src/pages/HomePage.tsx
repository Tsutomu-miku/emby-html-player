import { Link } from 'react-router-dom'

/** 占位首页 —— 后续由并行任务填充为完整的"继续观看 + 下一集 + 推荐"布局 */
export function HomePage() {
  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">首页</h1>
        <p className="text-jelly-muted text-sm">继续观看、下一集、推荐内容会显示在这里。</p>
      </header>
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <HintCard to="/" title="继续观看" hint="上次未看完的内容会出现在这里" />
        <HintCard to="/" title="下一集" hint="你正在追的剧的下一集" />
        <HintCard to="/" title="最近添加" hint="媒体库中最新加入的内容" />
        <HintCard to="/" title="电影推荐" hint="基于你看过的电影推荐" />
      </div>
    </div>
  )
}

function HintCard({ to, title, hint }: { to: string; title: string; hint: string }) {
  return (
    <Link to={to} className="card block p-5">
      <div className="font-semibold text-lg">{title}</div>
      <div className="mt-1 text-sm text-jelly-muted">{hint}</div>
    </Link>
  )
}
