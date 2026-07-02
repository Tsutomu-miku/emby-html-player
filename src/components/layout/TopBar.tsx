import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { IconButton } from '@/components/ui/primitives'
import { SearchSuggest } from '@/components/ui/SearchSuggest'
import { UserMenu } from './parts/UserMenu'
import { useBreadcrumbs } from './parts/useBreadcrumbs'
import { cx } from '@/utils'
import './TopBar.scss'

/**
 * 顶栏：
 *   [汉堡 · 面包屑]  [搜索 (居中弹性，右部含 mic/cast 图标)]
 *   [cast · tv-cast · 用户菜单]
 *
 * 顶部无内容时完全透明；滚动 24px 后恢复玻璃背景 + 下分隔线。
 * 面包屑封装在 `useBreadcrumbs`，用户菜单封装在 `parts/UserMenu`。
 */
export function TopBar() {
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.userId)
  const crumbs = useBreadcrumbs()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const SCROLL_THRESHOLD = 20
    const onScroll = () => {
      const y = window.scrollY || document.documentElement.scrollTop || 0
      setScrolled(y > SCROLL_THRESHOLD)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className={cx('topbar', scrolled && 'is-scrolled')}>
      <div className="topbar__inner">
        <div className="topbar__leading">
          <IconButton
            type="button"
            aria-label="菜单"
            className="topbar__mobile-button"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </IconButton>

          <nav className="topbar__crumbs" aria-label="面包屑">
            {crumbs.map((c, i) => (
              <span key={i} className="topbar__crumb">
                {i > 0 && (
                  <span className="topbar__crumb-separator" aria-hidden="true">
                    ›
                  </span>
                )}
                {c.to ? (
                  <a
                    href={c.to}
                    onClick={(e) => {
                      e.preventDefault()
                      void navigate(c.to as string)
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
          <SearchSuggest className="topbar__search-box" userId={userId} />
          <span className="topbar__search-extras" aria-hidden="true">
            <button type="button" className="topbar__search-extra" title="语音搜索" aria-label="语音搜索">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="2" width="6" height="12" rx="3" />
                <path d="M5 10a7 7 0 0 0 14 0" />
                <line x1="12" y1="17" x2="12" y2="22" />
                <line x1="8" y1="22" x2="16" y2="22" />
              </svg>
            </button>
            <button type="button" className="topbar__search-extra" title="投屏到设备" aria-label="投屏">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="14" rx="2" />
                <line x1="8" y1="20" x2="16" y2="20" />
                <line x1="12" y1="18" x2="12" y2="20" />
              </svg>
            </button>
          </span>
        </div>

        <div className="topbar__actions">
          <IconButton
            type="button"
            aria-label="播放状态"
            className="topbar__round"
            title="播放状态"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12h2l2-5 3 10 2-7 2 4h7" />
            </svg>
          </IconButton>
          <IconButton
            type="button"
            aria-label="投屏"
            className="topbar__round"
            title="投屏"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="12" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
          </IconButton>
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
