// 把 time.ts 中的常用工具重新导出，方便 UI / hooks 使用统一入口
export * from './time'

/**
 * 组合 className 的工具。
 * 原先是自写实现，现直接重导出 npm clsx（行为一致，零成本切换）。
 */
export { default as cx } from 'clsx'

/** 规范化服务器地址输入 */
export function normalizeServerUrl(input: string): string {
  let s = (input || '').trim()
  if (!s) return ''
  if (!/^https?:\/\//i.test(s)) {
    // 如果是 host:port，默认 http
    s = `http://${s}`
  }
  try {
    const u = new URL(s)
    // 去掉多余的 /web 路径
    u.pathname = u.pathname.replace(/\/web\/?$/i, '').replace(/\/+$/g, '')
    return u.toString().replace(/\/$/, '')
  } catch {
    return s.replace(/\/+$/, '')
  }
}

/** 判断路径是否为 HTTP(S) URL */
export function isAbsoluteUrl(s: string): boolean {
  return /^https?:\/\//i.test(s)
}

/** 简单防抖 */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  wait = 300,
): (...args: A) => void {
  let t: ReturnType<typeof setTimeout> | null = null
  return function debounced(this: unknown, ...args: A) {
    if (t) clearTimeout(t)
    t = setTimeout(() => {
      t = null
      fn.apply(this, args)
    }, wait)
  }
}

/** 简单节流 */
export function throttle<A extends unknown[]>(
  fn: (...args: A) => void,
  wait = 300,
): (...args: A) => void {
  let last = 0
  let pending: { args: A; this: unknown } | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  return function throttled(this: unknown, ...args: A) {
    const now = Date.now()
    const remaining = wait - (now - last)
    if (remaining <= 0) {
      last = now
      fn.apply(this, args)
    } else {
      pending = { args, this: this }
      if (!timer) {
        timer = setTimeout(() => {
          timer = null
          last = Date.now()
          if (pending) {
            fn.apply(pending.this, pending.args)
            pending = null
          }
        }, remaining)
      }
    }
  }
}

/**
 * 把比特率（bps）格式化为人类可读字符串。
 * - 0 / undefined / NaN 等返回 "—"
 * - 小于 1_000_000（1 Mbps）使用 kbps：取整
 * - 否则使用 Mbps：保留一位小数
 */
export function humanBitrate(bps?: number): string {
  if (!bps || !Number.isFinite(bps)) return '—'
  if (bps < 1_000_000) {
    return `${Math.round(bps / 1000)} kbps`
  }
  return `${(bps / 1_000_000).toFixed(1)} Mbps`
}
