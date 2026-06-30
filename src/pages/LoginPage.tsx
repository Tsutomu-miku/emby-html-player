import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { authenticateByName, getCurrentUser, getPublicSystemInfo } from '@/api'
import { normalizeServerUrl, cx } from '@/utils'
import type { PublicSystemInfo } from '@/api/types'

/**
 * 登录页：输入服务器地址、用户名、密码，成功后跳转到原先要访问的页面（或 /）。
 * 同时尝试获取公共系统信息，用于连接测试。
 */
export function LoginPage() {
  const login = useAuthStore((s) => s.login)
  const setServer = useAuthStore((s) => s.setServer)
  const navigate = useNavigate()
  const location = useLocation() as { state?: { from?: { pathname?: string } } }
  const redirectTo = location.state?.from?.pathname || '/'

  const [server, setServerInput] = useState<string>(useAuthStore.getState().server || '')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [testing, setTesting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [serverInfo, setServerInfo] = useState<{ name: string; version: string } | null>(null)

  useEffect(() => {
    // 有默认服务器的话先尝试连
    if (server) {
      let cancelled = false
      setTesting(true)
      const base = normalizeServerUrl(server)
      console.warn(`[LoginPage] 探测服务器 raw="${server}" normalized="${base}"`)
      getPublicSystemInfo(base)
        .then((r: PublicSystemInfo | undefined) => {
          if (cancelled || !r) return
          console.warn(`[LoginPage] 探测成功 serverName=${r.serverName} version=${r.version}`)
          setServerInfo({ name: r.serverName || 'Emby Server', version: r.version || '' })
        })
        .catch((e: unknown) => {
          console.error(
            `[LoginPage] 探测失败 base=${base}`,
            e instanceof Error ? { name: e.name, message: e.message, cause: (e as Error & { cause?: unknown }).cause } : e,
          )
          if (!cancelled) setServerInfo(null)
        })
        .finally(() => !cancelled && setTesting(false))
      return () => { cancelled = true }
    } else {
      setServerInfo(null)
    }
  }, [server])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    const normalized = normalizeServerUrl(server)
    if (!normalized) {
      setErr('请填写服务器地址')
      return
    }
    if (!username) {
      setErr('请填写用户名')
      return
    }
    setSubmitting(true)
    try {
      setServer(normalized)
      const res = await authenticateByName({
        server: normalized,
        username,
        pw: password,
      })
      if (!res.accessToken || !res.user) {
        throw new Error('服务器未返回 accessToken 或用户信息')
      }
      login(normalized, res.user.id, res.accessToken, res.user)
      // 异步刷新当前用户完整资料
      let user = res.user
      try {
        user = await getCurrentUser()
        useAuthStore.getState().setUser(user)
      } catch {
        /* ignore */
      }
      void navigate(redirectTo, { replace: true })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(
        `[LoginPage] 登录失败 server=${normalized} user=${username}`,
        e instanceof Error ? { name: e.name, message: e.message, cause: (e as Error & { cause?: unknown }).cause } : e,
      )
      setErr(msg || String(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-jelly-bg">
      <form
        onSubmit={(e) => { void handleSubmit(e) }}
        className="w-full max-w-md bg-jelly-panel border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl space-y-5"
      >
        <div>
          <div className="text-2xl font-bold">登录到 Emby 服务器</div>
          <div className="text-sm text-jelly-muted mt-1">
            在网页里直接浏览和播放你的 Emby 媒体库
          </div>
        </div>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">服务器地址</span>
          <input
            className="input"
            placeholder="https://emby.example.com:8920 或 192.168.1.10:8096"
            value={server}
            onChange={(e) => setServerInput(e.target.value)}
            autoComplete="url"
            autoFocus
          />
          <div className="flex items-center gap-2 text-xs">
            {testing ? (
              <span className="text-jelly-muted">正在测试连接...</span>
            ) : serverInfo ? (
              <span className="text-green-400">
                已连接：{serverInfo.name} · 版本 {serverInfo.version}
              </span>
            ) : server ? (
              <span className="text-red-400">无法连接到该服务器</span>
            ) : null}
          </div>
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">用户名</span>
          <input
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            placeholder="例如 admin"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">密码</span>
          <input
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="服务器登录密码"
          />
        </label>
        <div
          className={cx(
            'text-sm rounded px-3 py-2 bg-red-500/10 border border-red-500/20 text-red-300',
            err ? 'block' : 'hidden',
          )}
          role="alert"
        >
          {err}
        </div>
        <button
          type="submit"
          className="btn w-full"
          disabled={submitting || testing || !server}
        >
          {submitting ? '登录中...' : '登录'}
        </button>
        <div className="text-xs text-jelly-muted leading-relaxed">
          提示：<br />
          · 凭据仅保存在你的浏览器 localStorage，本项目不会把它们发送到任何第三方服务器。<br />
          · 如果页面是 HTTPS，Emby 服务器也需要是 HTTPS，否则浏览器会拦截媒体请求。
        </div>
      </form>
    </div>
  )
}
