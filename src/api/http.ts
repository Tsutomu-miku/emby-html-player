import { getEmbyApiSession } from './embyApiSession'
import { camelToPascal, pascalToCamel } from '@/utils/casing'

export interface RequestOptions
  extends Omit<RequestInit, 'body' | 'headers'> {
  /** 是否通过 query string 发送 api_key（Emby 对 Authorization header 的预检偶尔不友好） */
  useQueryAuth?: boolean
  /** 请求超时（ms） */
  timeout?: number
  /** 需要的 query 参数（使用 camelCase 传入，自动转为 PascalCase） */
  params?: Record<string, string | number | boolean | undefined>
  /** 期望响应类型 */
  expect?: 'json' | 'blob' | 'text' | 'raw'
  /** 请求体：对象会自动 JSON 序列化并转为 PascalCase；也支持 FormData / Blob / string 等原生 BodyInit。 */
  body?: unknown
  /** 请求头；允许为普通对象。不做大小写转换。 */
  headers?: Record<string, string> | Headers
}

/** 判定字符串是否为完整的 http(s) URL（用于登录前的绝对 URL 请求） */
function isFullHttpUrl(s: string): boolean {
  return /^https?:\/\//i.test(s)
}

/** HTTP 请求失败时抛出的错误子类，携带 status 与 body 便于业务层判断 */
class HttpError extends Error {
  status: number
  body: string
  constructor(message: string, status: number, body: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'HttpError'
    this.status = status
    this.body = body
  }
}

/** 将对象转为 query string，忽略 undefined/null/空串值。 */
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
 * 关键约定：
 * - path 以 http(s):// 开头：视为完整 URL，直接使用（不再拼接 server），但仍会按 useQueryAuth 附加鉴权参数。
 *   这用于登录前尚未配置全局 server 时的请求（例如 getPublicSystemInfo、getPublicUsers、authenticateByName）。
 * - 普通 path（/xx/yy）：从 authStore 取 server 拼接。
 *
 * 大小写转换：
 * - params（query）：整体 camelToPascal，保证 Emby 后端识别 PascalCase（如 StartIndex / SortBy / Fields）。
 * - body（当为普通对象或数组）：camelToPascal 后 JSON.stringify。FormData/Blob/string 不变。
 * - 响应（expect==='json'）：解析后 pascalToCamel，得到的字段与 types.ts 的 camelCase 类型一致。
 *
 * 错误信息：
 * - AbortError（超时触发的 abort）：消息为「请求已超时」。
 * - TypeError（典型是网络不可达、CORS 失败等）：消息为「网络异常，无法连接服务器」。
 * - 其他：保持原始 throw。
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

  const { server, accessToken, deviceId, onUnauthorized } = getEmbyApiSession()

  // 判定是否为完整 URL：完整 URL 则 base = ""，path 作为 URL 直接用。
  const pathIsAbsolute = isFullHttpUrl(path)
  let base: string
  let normalizedPath: string
  if (pathIsAbsolute) {
    base = ''
    normalizedPath = path
  } else {
    if (!server) throw new Error('未配置服务器地址，请先登录')
    base = server.replace(/\/+$/, '')
    normalizedPath = path.startsWith('/') ? path : `/${path}`
  }

  // 1. query params：将调用方传入的 camelCase 转为 Emby 需要的 PascalCase
  const convertedParams = camelToPascal(
    params,
  ) as Record<string, string | number | boolean | undefined>

  // 2. 鉴权参数（使用 PascalCase 形式的 key：ApiKey/DeviceId 本来就是大写开头；
  //    api_key 也直接写；camelToPascal 会把 api_key 变成 Api_key？——不，我们直接手动设定 key，
  //    不需要走转换，所以放在下面单独赋值即可。）
  const allParams: Record<string, string | number | boolean | undefined> = {
    ...convertedParams,
  }
  if (useQueryAuth && accessToken) {
    // api_key 是 Emby 约定的 query key，保持原样（注意不是 ApiKey，就是 api_key）
    allParams.api_key = accessToken
    allParams.DeviceId = deviceId
  }
  const qs = buildQuery(allParams)

  // 组装最终 URL
  let url: string
  if (pathIsAbsolute) {
    // path 本身已经是完整 URL，若已有 query，则用 & 追加，否则 ? 追加
    if (qs) {
      const sep = path.includes('?') ? '&' : '?'
      url = `${path}${sep}${qs}`
    } else {
      url = path
    }
  } else {
    url = `${base}${normalizedPath}${qs ? `?${qs}` : ''}`
  }

  // 3. body 处理：仅对普通对象/数组做 camelToPascal + JSON.stringify
  const isPlainObjectBody =
    body !== undefined &&
    body !== null &&
    !(body instanceof FormData) &&
    !(body instanceof Blob) &&
    typeof body !== 'string' &&
    typeof body === 'object'

  const hdrs = new Headers({
    Accept: 'application/json',
    ...(body instanceof FormData
      ? {}
      : isPlainObjectBody
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

  // 序列化 body
  let serializedBody: BodyInit | undefined
  if (body instanceof FormData || body instanceof Blob || typeof body === 'string') {
    serializedBody = body
  } else if (isPlainObjectBody) {
    serializedBody = JSON.stringify(camelToPascal(body))
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  const logUrl = redactUrl(url, accessToken, deviceId)

  let response: Response
  try {
    response = await fetch(url, {
      ...rest,
      method,
      headers: hdrs,
      body: serializedBody,
      signal: controller.signal,
    })
  } catch (err) {
    console.error(
      `[http] ✗ fetch threw ${method} ${logUrl}`,
      {
        errName: err instanceof Error ? err.name : typeof err,
        errMessage: err instanceof Error ? err.message : String(err),
        errCause: err instanceof Error ? (err as Error & { cause?: unknown }).cause : undefined,
      },
    )
    // 分类常见错误，给出更友好提示
    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        throw new Error('请求已超时', { cause: err })
      }
      if (err instanceof TypeError) {
        throw new Error('网络异常，无法连接服务器', { cause: err })
      }
    }
    throw err
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    let text = ''
    try {
      text = await response.text()
    } catch (err) {
      console.warn('[http] failed to read error response body', err)
    }
    console.warn(
      `[http] ← HTTP ${response.status} ${method} ${logUrl}`,
      { statusText: response.statusText, bodyPreview: text.slice(0, 240) },
    )
    const err = new HttpError(
      `HTTP ${response.status} ${response.statusText}${text ? `: ${text.slice(0, 300)}` : ''}`,
      response.status,
      text,
    )
    if (response.status === 401) {
      onUnauthorized?.()
    }
    throw err
  }
  if (expect === 'raw') return response as unknown as T
  if (expect === 'blob') return (await response.blob()) as unknown as T
  if (expect === 'text') return (await response.text()) as unknown as T

  // json：先做原始解析，再递归转 camelCase
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    // 某些接口返回空 204
    return undefined as unknown as T
  }
  const raw: unknown = await response.json()
  return pascalToCamel<T>(raw)
}

/**
 * 构造 X-Emby-Authorization 头。
 *
 * Client 必须与主进程 UA（Emby Web/4.7.10.0）保持一致。
 * 注意：不能用 "Emby Theater"——某些 Emby 反代（如 genshin.biliblili.uk）对 Theater
 * 客户端做特殊路由，会直接返回 404；"Emby Web" 走标准 API 路由。
 * 这不是鉴权——真正的鉴权是登录后拿到的 Token。
 */
function buildAuthorizationHeader(deviceId: string, accessToken?: string): string {
  const parts: string[] = [
    `MediaBrowser Client="Emby Web"`,
    `Device="${detectDeviceName()}"`,
    `DeviceId="${deviceId}"`,
    `Version="4.7.10.0"`,
  ]
  if (accessToken) {
    parts.push(`Token="${accessToken}"`)
  }
  return parts.join(', ')
}

function redactUrl(url: string, accessToken: string, deviceId: string): string {
  if (!URL.canParse(url)) {
    return redactSecret(redactSecret(url, accessToken), deviceId)
  }
  const parsed = new URL(url)
  if (parsed.searchParams.has('api_key')) parsed.searchParams.set('api_key', 'redacted')
  if (parsed.searchParams.has('DeviceId')) parsed.searchParams.set('DeviceId', 'redacted')
  return parsed.toString()
}

function redactSecret(value: string, secret: string): string {
  if (!secret) return value
  return value.split(secret).join('redacted')
}

/** 从 navigator.platform 推断设备名，用于 X-Emby-Authorization 的 Device 字段 */
function detectDeviceName(): string {
  const p = globalThis.navigator?.platform || ''
  if (/mac/i.test(p)) return 'macOS'
  if (/win/i.test(p)) return 'Windows'
  if (/linux/i.test(p)) return 'Linux'
  return 'Desktop'
}
