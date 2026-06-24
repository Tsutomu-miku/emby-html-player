/** 简单组合 className 的工具 */
export function cx(
  ...parts: (string | false | null | undefined | Record<string, boolean | undefined>)[]
): string {
  const out: string[] = []
  for (const p of parts) {
    if (!p) continue
    if (typeof p === 'string') {
      out.push(p)
      continue
    }
    for (const k of Object.keys(p)) {
      if ((p as Record<string, boolean | undefined>)[k]) out.push(k)
    }
  }
  return out.join(' ')
}

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
