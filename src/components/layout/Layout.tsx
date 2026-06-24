import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { getUserViews } from '@/api'
import type { UserView } from '@/api'
import { useEffect, useState } from 'react'
import { getImageUrl } from '@/api/images'

export function Layout() {
  const [views, setViews] = useState<UserView[]>([])
  const user = useAuthStore((s) => s.user)
  const userId = useAuthStore((s) => s.userId)
  const logout = useAuthStore((s) => s.logout)
  const location = useLocation()

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    getUserViews(userId)
      .then((r) => !cancelled && setViews(r.items || []))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [userId])

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-jelly-bg">
      {/* 侧栏 */}
      <aside className="md:w-56 md:shrink-0 bg-jelly-panel border-b md:border-b-0 md:border-r border-white/5 px-4 py-4 flex md:flex-col gap-2 overflow-x-auto md:overflow-y-auto">
        <Link
          to="/"
          className="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-md text-white font-semibold"
        >
          <span className="inline-block w-6 h-6 rounded bg-jelly-accent text-white flex items-center justify-center text-xs">E</span>
          Emby H5
        </Link>
        <NavLink to="/" active={location.pathname === '/'}>首页</NavLink>
        <div className="mt-2 text-xs uppercase text-jelly-muted px-3 hidden md:block">媒体库</div>
        {views.map((v) => (
          <NavLink
            key={v.id}
            to={`/library/${v.id}`}
            active={location.pathname.startsWith(`/library/${v.id}`)}
          >
            <span className="flex-1 truncate">{v.name || '未命名'}</span>
            <LibraryIconBadge collectionType={v.collectionType} />
          </NavLink>
        ))}
        <div className="mt-auto hidden md:block">
          <div className="flex items-center gap-2 p-2 rounded bg-white/5">
            <img
              alt=""
              className="w-8 h-8 rounded-full bg-jelly-hover object-cover"
              src={
                user?.id && user.primaryImageTag
                  ? getImageUrl(user.id, 'Primary', user.primaryImageTag, { width: 64, height: 64 })
                  : 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="%2320232c"/><text x="16" y="20" text-anchor="middle" fill="%238a8f9c" font-size="14">U</text></svg>'
              }
            />
            <div className="min-w-0 flex-1">
              <div className="text-sm text-jelly-text truncate">{user?.name || '未登录'}</div>
              <button
                onClick={logout}
                className="text-xs text-jelly-muted hover:text-jelly-text underline underline-offset-2"
              >退出登录</button>
            </div>
          </div>
        </div>
      </aside>
      {/* 主区域 */}
      <main className="flex-1 min-w-0">
        <div className="px-4 md:px-8 py-6 max-w-[1600px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

function NavLink({
  to,
  children,
  active,
}: {
  to: string
  children: React.ReactNode
  active?: boolean
}) {
  return (
    <Link
      to={to}
      className={
        'shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm transition ' +
        (active ? 'bg-white/10 text-white' : 'text-jelly-text hover:bg-white/5')
      }
    >
      {children}
    </Link>
  )
}

function LibraryIconBadge({ collectionType }: { collectionType?: string }) {
  const label = (() => {
    switch (collectionType) {
      case 'movies': return '电影'
      case 'tvshows': return '剧集'
      case 'music': return '音乐'
      case 'boxsets': return '合集'
      case 'musicvideos': return 'MV'
      case 'homevideos': return '家庭'
      case 'photos': return '照片'
      case 'books': return '图书'
      case 'playlists': return '歌单'
      case 'liveTv': return '直播'
      default: return '文件夹'
    }
  })()
  return <span className="text-[10px] uppercase tracking-wide text-jelly-muted">{label}</span>
}
