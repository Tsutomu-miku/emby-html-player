import { Link, NavLink as RRNavLink, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/auth'
import { getUserViews, type UserView } from '@/api'
import { getImageUrl } from '@/api/images'
import { cx } from '@/utils'
import { StatusDot } from '@/components/ui/primitives'
import './Sidebar.scss'

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
      .catch((e: unknown) => console.error('[Sidebar] getUserViews failed:', e))
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
    void navigate('/login', { replace: true })
  }

  return (
    <aside className="sidebar">
      <Link to="/" className="sidebar__brand">
        <span className="sidebar__brand-mark" aria-hidden="true">
          <span className="sidebar__brand-mark-inner" />
        </span>
        <span className="sidebar__brand-text">Emby H5</span>
      </Link>

      <SidebarNavLink to="/" active={location.pathname === '/'} exactMatch>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="sidebar__icon"
        >
          <path d="M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1V9.5Z" />
        </svg>
        <span>首页</span>
      </SidebarNavLink>

      <div className="sidebar__section-title">媒体库</div>

      <div className="sidebar__library-list">
        {views.map((v) => (
          <SidebarNavLink
            key={v.id}
            to={`/library/${v.id}`}
            active={location.pathname.startsWith(`/library/${v.id}`)}
          >
            <LibraryGlyph collectionType={v.collectionType} />
            <span className="sidebar__label">{v.name || '未命名'}</span>
            <span className="chip sidebar__chip">{collectionTypeLabel(v.collectionType)}</span>
          </SidebarNavLink>
        ))}
      </div>

      <SidebarNavLink to="/settings" active={location.pathname === '/settings'}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="sidebar__icon"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
        </svg>
        <span>设置</span>
      </SidebarNavLink>

      <div className="sidebar__user">
        <div className="sidebar__user-card">
          <div className="sidebar__avatar">
            {avatarSrc ? (
              <img alt="" src={avatarSrc} />
            ) : (
              <span>{(user?.name || 'U').slice(0, 1).toUpperCase()}</span>
            )}
            <StatusDot className="sidebar__avatar-dot" />
          </div>
          <div className="sidebar__user-main">
            <div className="sidebar__user-name">{user?.name || '未登录'}</div>
            <button onClick={handleLogout} className="sidebar__logout" type="button">
              退出登录
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}

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
  return (
    <RRNavLink
      to={to}
      end={exactMatch}
      className={({ isActive }) => cx('sidebar__nav-link', (isActive || active) && 'is-active')}
    >
      {children}
    </RRNavLink>
  )
}

function LibraryGlyph({ collectionType }: { collectionType?: string }) {
  if (collectionType === 'movies') {
    return (
      <svg
        viewBox="0 0 24 24"
        className="sidebar__icon"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M7 5v14M17 5v14M3 9h4M17 9h4M3 15h4M17 15h4" />
      </svg>
    )
  }
  if (collectionType === 'tvshows') {
    return (
      <svg
        viewBox="0 0 24 24"
        className="sidebar__icon"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="m8 3 4 4 4-4" />
      </svg>
    )
  }
  return (
    <svg
      viewBox="0 0 24 24"
      className="sidebar__icon"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M9 9h6v6H9z" />
    </svg>
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
