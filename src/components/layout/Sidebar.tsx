import { Link, NavLink as RRNavLink, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/auth'
import { getUserViews, type UserView } from '@/api'
import { getImageUrl } from '@/api/images'
import { cx } from '@/utils'

/**
 * 侧边栏：
 * - 桌面端：竖排布局，含 Logo、首页导航、媒体库列表、底部用户信息
 * - 移动端：横向滚动排布（仅 Logo + 导航 + 媒体库 chip）
 */
export function Sidebar() {
  const [views, setViews] = useState<UserView[]>([])
  const user = useAuthStore((s) => s.user)
  const userId = useAuthStore((s) => s.userId)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    getUserViews(userId)
      .then((r) => {
        if (!cancelled) setViews(r.items || [])
      })
      .catch(() => {
        /* 静默失败，空列表 */
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const avatarSrc =
    user?.id && user.primaryImageTag
      ? getImageUrl(user.id, 'Primary', user.primaryImageTag, {
          width: 64,
          height: 64,
          placeholderOnMissing: true,
        })
      : ''

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <aside
      className={cx(
        'bg-jelly-panel border-b md:border-b-0 md:border-r border-white/5',
        'px-3 md:px-4 py-3 md:py-4',
        'flex md:flex-col gap-1 md:gap-1',
        'overflow-x-auto md:overflow-y-auto md:shrink-0 md:w-56',
        'md:min-h-screen',
      )}
    >
      {/* Logo */}
      <Link
        to="/"
        className="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-md text-white font-semibold"
      >
        <span className="inline-block w-7 h-7 rounded-md bg-jelly-accent text-white flex items-center justify-center text-sm font-bold">
          E
        </span>
        <span className="hidden sm:inline">Emby H5</span>
      </Link>

      {/* 首页导航 */}
      <SidebarNavLink to="/" active={location.pathname === '/'} exactMatch>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-4 h-4 shrink-0"
        >
          <path d="M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1V9.5Z" />
        </svg>
        <span>首页</span>
      </SidebarNavLink>

      {/* 媒体库分区标题（仅桌面端） */}
      <div className="mt-1 text-xs uppercase text-jelly-muted px-3 hidden md:block tracking-wider">
        媒体库
      </div>

      {/* 媒体库列表 */}
      <div className="contents md:contents">
        {views.map((v) => (
          <SidebarNavLink
            key={v.id}
            to={`/library/${v.id}`}
            active={location.pathname.startsWith(`/library/${v.id}`)}
          >
            <span className="flex-1 truncate">{v.name || '未命名'}</span>
            <span className="chip shrink-0">{collectionTypeLabel(v.collectionType)}</span>
          </SidebarNavLink>
        ))}
      </div>

      {/* 设置入口（桌面端底部，用户信息上方） */}
      <SidebarNavLink to="/settings" active={location.pathname === '/settings'}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-4 h-4 shrink-0"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
        </svg>
        <span>设置</span>
      </SidebarNavLink>

      {/* 底部用户信息（仅桌面端） */}
      <div className="mt-auto hidden md:block pt-3 border-t border-white/5 mt-4">
        <div className="flex items-center gap-2 p-2 rounded bg-white/5">
          <div className="w-8 h-8 rounded-full bg-jelly-hover overflow-hidden shrink-0 flex items-center justify-center text-jelly-muted text-xs font-medium">
            {avatarSrc ? (
              <img alt="" src={avatarSrc} className="w-full h-full object-cover" />
            ) : (
              <span>{(user?.name || 'U').slice(0, 1).toUpperCase()}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm text-jelly-text truncate">{user?.name || '未登录'}</div>
            <button
              onClick={handleLogout}
              className="text-xs text-jelly-muted hover:text-jelly-text underline underline-offset-2"
              type="button"
            >
              退出登录
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}

/** 侧栏中的单个导航链接 */
function SidebarNavLink({
  to,
  children,
  active,
  exactMatch,
}: {
  to: string
  children: React.ReactNode
  active?: boolean
  exactMatch?: boolean
}) {
  // 移动端紧凑显示，桌面端正常
  return (
    <RRNavLink
      to={to}
      end={exactMatch}
      className={({ isActive }) =>
        cx(
          'shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm transition',
          'text-jelly-text hover:bg-white/5',
          (isActive || active) && 'bg-white/10 text-white',
        )
      }
    >
      {children}
    </RRNavLink>
  )
}

export function collectionTypeLabel(ct?: string): string {
  switch (ct) {
    case 'movies':
      return '电影'
    case 'tvshows':
      return '剧集'
    case 'music':
      return '音乐'
    case 'boxsets':
      return '合集'
    case 'musicvideos':
      return 'MV'
    case 'homevideos':
      return '家庭'
    case 'photos':
      return '照片'
    case 'books':
      return '图书'
    case 'playlists':
      return '歌单'
    case 'liveTv':
      return '直播'
    case 'trailers':
      return '预告片'
    case 'folders':
      return '文件夹'
    default:
      return ct || '媒体库'
  }
}
