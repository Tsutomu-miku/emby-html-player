import { useState, useMemo, useEffect } from 'react'
import { Link, useNavigate, useLocation, useParams } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { getUserViews, getItem, type UserView } from '@/api'
import { getImageUrl } from '@/api/images'
import { SearchSuggest } from '@/components/ui/SearchSuggest'
import { cx } from '@/utils'
import type { BaseItemDto } from '@/api/types'

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
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [userId])

  // 若当前路径是 /item/:itemId，懒加载 item 的名称用于面包屑
  useEffect(() => {
    if (!params.itemId || !userId) {
      setItemName('')
      return
    }
    let cancelled = false
    getItem(userId, params.itemId, { fields: 'BaseItemName' })
      .then((it: BaseItemDto) => {
        if (!cancelled) setItemName(it.name || '')
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [params.itemId, userId])

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
      result.push({ label: '播放' })
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
    navigate('/login', { replace: true })
  }

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-jelly-bg/85 border-b border-white/5">
      <div className="px-4 md:px-8 py-3 flex items-center gap-3 max-w-[1600px] mx-auto">
        {/* 左：汉堡（移动端）+ 面包屑 */}
        <div className="flex items-center gap-2 min-w-0 shrink-0 md:shrink md:min-w-0">
          {/* 汉堡按钮（仅视觉，移动端 Sidebar 已经横排，此处保留占位） */}
          <button
            type="button"
            aria-label="菜单"
            className="md:hidden p-2 -ml-2 rounded-md text-jelly-muted hover:text-jelly-text hover:bg-white/5 transition"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-5 h-5">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          {/* 面包屑 */}
          <nav className="hidden md:flex items-center gap-1.5 text-sm min-w-0 max-w-xs">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1.5 min-w-0">
                {i > 0 && <span className="text-jelly-muted">/</span>}
                {c.to ? (
                  <a
                    href={c.to}
                    onClick={(e) => {
                      e.preventDefault()
                      navigate(c.to!)
                    }}
                    className="truncate text-jelly-muted hover:text-jelly-text transition-colors"
                  >
                    {c.label}
                  </a>
                ) : (
                  <span className="truncate text-jelly-text">{c.label}</span>
                )}
              </span>
            ))}
          </nav>
        </div>

        {/* 中：搜索框 */}
        <div className="flex-1 flex justify-center">
          <SearchSuggest />
        </div>

        {/* 右：返回按钮 + 用户菜单 */}
        <div className="flex items-center gap-1 shrink-0">
          {/* 返回按钮 */}
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="返回"
            className="p-2 rounded-md text-jelly-muted hover:text-jelly-text hover:bg-white/5 transition"
            title="返回上一页"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>

          {/* 用户菜单 */}
          <div className="relative" data-user-menu>
            <button
              type="button"
              onClick={() => setUserMenuOpen((v) => !v)}
              className={cx(
                'p-0.5 rounded-full hover:bg-white/10 transition flex items-center',
                userMenuOpen && 'bg-white/10',
              )}
              aria-label="用户菜单"
            >
              <div className="w-8 h-8 rounded-full bg-jelly-hover overflow-hidden shrink-0 flex items-center justify-center text-jelly-muted text-xs font-medium border border-white/10">
                {avatarSrc ? (
                  <img alt="" src={avatarSrc} className="w-full h-full object-cover" />
                ) : (
                  <span>{(user?.name || 'U').slice(0, 1).toUpperCase()}</span>
                )}
              </div>
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 z-50 bg-jelly-card border border-white/10 rounded-lg shadow-2xl overflow-hidden py-1">
                <div className="px-3 py-2 border-b border-white/5">
                  <div className="text-sm text-jelly-text truncate font-medium">
                    {user?.name || '未登录'}
                  </div>
                  {user?.id && (
                    <div className="text-xs text-jelly-muted truncate mt-0.5">ID: {user.id.slice(0, 8)}…</div>
                  )}
                </div>
                <Link
                  to="/settings"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm text-jelly-text hover:bg-white/5 transition"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
                  </svg>
                  <span>设置</span>
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm text-red-300 hover:bg-white/5 transition"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
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
