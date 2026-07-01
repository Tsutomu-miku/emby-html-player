import { useState, useMemo, useEffect } from 'react'
import { Link, useNavigate, useLocation, useParams } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { getUserViews, getItem, type UserView } from '@/api'
import { getImageUrl } from '@/api/images'
import { SearchSuggest } from '@/components/ui/SearchSuggest'
import { IconButton, StatusDot } from '@/components/ui/primitives'
import { cx } from '@/utils'
import type { BaseItemDto } from '@/api/types'
import './TopBar.scss'

/**
 * 顶栏：移动端汉堡、面包屑、中间搜索框、右侧返回/用户菜单。
 */
export function TopBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams()
  const userId = useAuthStore((s) => s.userId)
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  const [views, setViews] = useState<UserView[]>([])
  const [itemName, setItemName] = useState<string>('')
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  // 加载媒体库列表（用于面包屑）
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    getUserViews(userId)
      .then((r) => {
        if (!cancelled) setViews(r.items || [])
      })
      .catch((error: unknown) => {
        console.error('[TopBar] failed to load user views:', error)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  // 若当前路径是 /item/:itemId 或 /player/:itemId，懒加载 item 的名称用于面包屑
  useEffect(() => {
    const needsItemName =
      location.pathname.startsWith('/item/') ||
      location.pathname.startsWith('/player/')
    if (!params.itemId || !userId || !needsItemName) {
      setItemName('')
      return
    }
    let cancelled = false
    getItem(userId, params.itemId, { fields: 'BaseItemName' })
      .then((it: BaseItemDto) => {
        if (!cancelled) setItemName(it.name || '')
      })
      .catch((error: unknown) => {
        console.error('[TopBar] failed to load breadcrumb item:', error)
      })
    return () => {
      cancelled = true
    }
  }, [location.pathname, params.itemId, userId])

  // 点击外部关闭用户菜单
  useEffect(() => {
    if (!userMenuOpen) return
    function onClick(e: MouseEvent) {
      const t = e.target as HTMLElement
      if (!t.closest('[data-user-menu]')) setUserMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [userMenuOpen])

  // 面包屑：根据路径生成
  const crumbs = useMemo(() => {
    const result: { label: string; to?: string }[] = [{ label: '首页', to: '/' }]
    if (location.pathname.startsWith('/library/')) {
      const id = location.pathname.slice('/library/'.length).split('/')[0]
      const v = views.find((x) => x.id === id)
      result.push({ label: v?.name || '媒体库', to: `/library/${id}` })
    } else if (location.pathname.startsWith('/item/')) {
      if (itemName) {
        result.push({ label: itemName })
      } else {
        result.push({ label: '详情' })
      }
    } else if (location.pathname.startsWith('/player/')) {
      result.push({ label: '播放中' })
      result.push({ label: itemName || '当前媒体' })
    }
    return result
  }, [location.pathname, views, itemName])

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
    <header className="topbar">
      <div className="topbar__inner">
        <div className="topbar__leading">
          <IconButton
            type="button"
            aria-label="菜单"
            className="topbar__mobile-button"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </IconButton>

          <nav className="topbar__crumbs" aria-label="面包屑">
            {crumbs.map((c, i) => (
              <span key={i} className="topbar__crumb">
                {i > 0 && <span className="topbar__crumb-separator">/</span>}
                {c.to ? (
                  <a
                    href={c.to}
                    onClick={(e) => {
                      e.preventDefault()
                      const target = c.to
                      if (target) void navigate(target)
                    }}
                    className="topbar__crumb-link"
                  >
                    {c.label}
                  </a>
                ) : (
                  <span className="topbar__crumb-current">{c.label}</span>
                )}
              </span>
            ))}
          </nav>
        </div>

        <div className="topbar__search">
          <SearchSuggest className="topbar__search-box" />
        </div>

        <div className="topbar__actions">
          <IconButton
            type="button"
            onClick={() => { void navigate(-1) }}
            aria-label="返回"
            className="topbar__action"
            title="返回上一页"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </IconButton>

          <div className="topbar__user" data-user-menu>
            <button
              type="button"
              onClick={() => setUserMenuOpen((v) => !v)}
              className={cx(
                'topbar__user-button',
                userMenuOpen && 'is-open',
              )}
              aria-label="用户菜单"
            >
              <div className="topbar__avatar">
                {avatarSrc ? (
                  <img alt="" src={avatarSrc} />
                ) : (
                  <span>{(user?.name || 'U').slice(0, 1).toUpperCase()}</span>
                )}
                <StatusDot className="topbar__avatar-dot" />
              </div>
            </button>

            {userMenuOpen && (
              <div className="topbar__menu">
                <div className="topbar__menu-head">
                  <div className="topbar__menu-name">
                    {user?.name || '未登录'}
                  </div>
                  {user?.id && (
                    <div className="topbar__menu-meta">ID: {user.id.slice(0, 8)}...</div>
                  )}
                </div>
                <Link
                  to="/settings"
                  onClick={() => setUserMenuOpen(false)}
                  className="topbar__menu-item"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="topbar__menu-icon">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
                  </svg>
                  <span>设置</span>
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="topbar__menu-item topbar__menu-item--danger"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="topbar__menu-icon">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span>退出登录</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
