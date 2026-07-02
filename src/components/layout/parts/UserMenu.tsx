import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { getImageUrl } from '@/api/images'
import { StatusDot } from '@/components/ui/primitives'
import { cx } from '@/utils'
import './UserMenu.scss'

/**
 * 顶栏右侧用户菜单：头像按钮 + 下拉菜单（设置 / 退出登录）。
 */
export function UserMenu() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

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
    <div className="user-menu" ref={wrapRef} data-user-menu>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cx('user-menu__button', open && 'is-open')}
        aria-label="用户菜单"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <div className="user-menu__avatar">
          {avatarSrc ? (
            <img alt="" src={avatarSrc} />
          ) : (
            <span>{(user?.name || 'U').slice(0, 1).toUpperCase()}</span>
          )}
          <StatusDot className="user-menu__avatar-dot" />
        </div>
      </button>

      {open && (
        <div className="user-menu__panel animate-menu-in">
          <div className="user-menu__head">
            <div className="user-menu__name">{user?.name || '未登录'}</div>
            {user?.id && (
              <div className="user-menu__meta">
                ID: {user.id.slice(0, 8)}...
              </div>
            )}
          </div>
          <Link
            to="/settings"
            onClick={() => setOpen(false)}
            className="user-menu__item"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="user-menu__icon"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
            </svg>
            <span>设置</span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="user-menu__item user-menu__item--danger"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="user-menu__icon"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>退出登录</span>
          </button>
        </div>
      )}
    </div>
  )
}
