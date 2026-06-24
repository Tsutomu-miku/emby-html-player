import { useAuthStore } from '@/store/auth'

export interface RequestOptions
  extends Omit<RequestInit, 'body' | 'headers'> {
  /** 是否通过 query string 发送 api_key（Emby 对 Authorization header 的预检偶尔不友好） */
  useQueryAuth?: boolean
  /** 请求超时（ms） */
  timeout?: number
  /** 需要的 query 参数 */
  params?: Record<string, string | number | boolean | undefined>
  /** 期望响应类型 */
  expect?: 'json' | 'blob' | 'text' | 'raw'
  /** 请求体：对象会自动 JSON 序列化；也支持 FormData / Blob / string 等原生 BodyInit。 */
  body?: unknown
  /** 请求头；允许为普通对象。 */
  headers?: Record<string, string> | Headers
}

/** 将对象转为 query string，忽略 undefined 值。 */
export function buildQuery(
  params: Record<string, string | number | boolean | undefined>,
): string {
  const out: string[] = []
  for (const key of Object.keys(params)) {
    const val = params[key]
    if (val === undefined || val === null || val === '') continue
    out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(val))}`)
  }
  return out.join('&')
}

/**
 * 通用 HTTP 请求：自动拼接 server URL、附加 api_key、处理错误。
 *
 * 注意：默认用 query `?api_key=` 附加 access_token，兼容性最好。
 */
export async function request<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    method = 'GET',
    headers,
    body,
    useQueryAuth = true,
    timeout = 30000,
    params = {},
    expect = 'json',
    ...rest
  } = options

  const { server, accessToken, deviceId } = useAuthStore.getState()
  if (!server) throw new Error('未配置服务器地址，请先登录')

  // 拼接基础 URL，去除末尾斜杠
  const base = server.replace(/\/+$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  const allParams: Record<string, string | number | boolean | undefined> = {
    ...params,
  }
  if (useQueryAuth && accessToken) {
    allParams.api_key = accessToken
    allParams.DeviceId = deviceId
  }
  const qs = buildQuery(allParams)
  const url = `${base}${normalizedPath}${qs ? `?${qs}` : ''}`

  const hdrs = new Headers({
    Accept: 'application/json',
    ...(body instanceof FormData
      ? {}
      : body && typeof body === 'object'
        ? { 'Content-Type': 'application/json' }
        : {}),
    ...(headers as Record<string, string> | undefined),
  })
  if (!useQueryAuth && accessToken) {
    hdrs.set('X-Emby-Token', accessToken)
  }
  hdrs.set(
    'X-Emby-Authorization',
    buildAuthorizationHeader(deviceId, accessToken),
  )

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  let response: Response
  try {
    response = await fetch(url, {
      ...rest,
      method,
      headers: hdrs,
      body:
        body instanceof FormData || body instanceof Blob || typeof body === 'string'
          ? body
          : body && typeof body === 'object'
            ? JSON.stringify(body)
            : undefined,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    let text = ''
    try {
      text = await response.text()
    } catch {
      /* ignore */
    }
    const err = new Error(
      `HTTP ${response.status} ${response.statusText}${text ? `: ${text.slice(0, 300)}` : ''}`,
    )
    ;(err as any).status = response.status
    ;(err as any).body = text
    if (response.status === 401) {
      // 凭据失效，登出
      try {
        useAuthStore.getState().logout()
      } catch {
        /* ignore */
      }
    }
    throw err
  }

  if (expect === 'raw') return response as unknown as T
  if (expect === 'blob') return (await response.blob()) as unknown as T
  if (expect === 'text') return (await response.text()) as unknown as T
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    // 某些接口返回空 204
    return undefined as unknown as T
  }
  return (await response.json()) as T
}

function buildAuthorizationHeader(deviceId: string, accessToken?: string): string {
  const parts: string[] = [
    `MediaBrowser Client="Emby H5 Player"`,
    `Device="Web Browser"`,
    `DeviceId="${deviceId}"`,
    `Version="0.1.0"`,
  ]
  if (accessToken) {
    parts.push(`Token="${accessToken}"`)
  }
  return parts.join(', ')
}
