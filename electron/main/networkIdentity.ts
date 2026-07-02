import { BrowserWindow, session } from 'electron'
import {
  applyEmbyApiIdentity,
  applyEmbyMediaIdentity,
  EMBY_USER_AGENT,
  isMediaRequest,
  isServerRequest,
  type EmbyAuthState,
} from './embyIdentity'

const DEBUG_LOGS = process.env['EHP_DEBUG_LOGS'] === '1'

type ResponseHeaders = Record<string, string[] | string | undefined>

interface MediaResponseDebug {
  statusCode: number
  method: string
  url: string
  contentType?: string
  contentLength?: string
  contentRange?: string
  acceptRanges?: string
  location?: string
}

export interface EmbyNetworkHandlersOptions {
  getAuth: () => EmbyAuthState
  getWindow: () => BrowserWindow | null
}

export function installEmbyNetworkHandlers(options: EmbyNetworkHandlersOptions): void {
  const corsHeaders: Record<string, string[]> = {
    'access-control-allow-origin': ['*'],
    'access-control-allow-credentials': ['true'],
    'access-control-allow-methods': ['GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH'],
    'access-control-allow-headers': [
      'Authorization, Content-Type, X-Emby-Authorization, X-Emby-Token, api_key, DeviceId, Range, Accept, Accept-Language, Origin, User-Agent',
    ],
    'access-control-expose-headers': [
      'Content-Length, Content-Range, Accept-Ranges, X-Emby-Server',
    ],
    'access-control-max-age': ['86400'],
  }

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const isHttp = /^https?:\/\//i.test(details.url)
    if (!isHttp) {
      callback({})
      return
    }
    if (details.method === 'OPTIONS') {
      debugLog(`[main] OPTIONS 预检覆写 → 204 ${redactLogUrl(details.url)}`)
      callback({
        statusLine: 'HTTP/1.1 204 No Content',
        responseHeaders: corsHeaders,
      })
      return
    }
    if (isExternalHttpUrl(details.url)) {
      logMediaResponse({
        method: details.method,
        statusCode: details.statusCode,
        url: details.url,
        responseHeaders: details.responseHeaders,
      }, options.getWindow())
    }
    callback({ responseHeaders: { ...(details.responseHeaders ?? {}), ...corsHeaders } })
  })

  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    if (!isExternalHttpUrl(details.url)) {
      callback({})
      return
    }
    const auth = options.getAuth()
    const isServer = isServerRequest(details.url, auth)
    const isServerMedia = isServer && isMediaRequest(details.url)
    const isRedirectedMedia =
      !isServer && auth.serverOrigin.length > 0 && details.resourceType === 'media'
    if (isServerMedia || isMediaRequest(details.url) || isRedirectedMedia) {
      const headers = applyEmbyMediaIdentity(
        { ...(details.requestHeaders ?? {}) },
        auth,
        details.url,
      )
      debugLogMediaRequest(details.method, details.url, auth, headers)
      callback({ requestHeaders: headers })
      return
    }
    if (!isServer) {
      callback({ requestHeaders: details.requestHeaders })
      return
    }
    callback({ requestHeaders: applyEmbyApiIdentity(details.requestHeaders ?? {}, auth) })
    debugLog(
      `[main] SERVER/EMBY ${details.method} ${redactLogUrl(details.url).slice(0, 180)} UA=${EMBY_USER_AGENT}`,
    )
  })

  session.defaultSession.webRequest.onBeforeRedirect((details) => {
    if (!isExternalHttpUrl(details.url)) return
    debugLog('[main] ↪ redirect', {
      statusCode: details.statusCode,
      method: details.method,
      from: redactLogUrl(details.url).slice(0, 180),
      to: redactLogUrl(details.redirectURL).slice(0, 180),
    })
  })

  session.defaultSession.webRequest.onCompleted((details) => {
    if (!isExternalHttpUrl(details.url)) return
    debugLog(
      `[main] ← ${details.statusCode} ${details.method} ${redactLogUrl(details.url)}`,
    )
  })

  session.defaultSession.webRequest.onErrorOccurred((details) => {
    if (!isExternalHttpUrl(details.url)) return
    console.error(
      `[main] ✗ ${details.method} ${redactLogUrl(details.url)} error=${details.error}`,
    )
  })
}

function isExternalHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url) &&
    !/^https?:\/\/(localhost|127\.0\.0\.1|::1)\b/i.test(url)
}

function isLikelyMediaResponse(url: string): boolean {
  if (isMediaRequest(url)) return true
  if (!URL.canParse(url)) return false
  return new URL(url).pathname.toLowerCase() === '/stream'
}

function readHeader(headers: ResponseHeaders | undefined, name: string): string | undefined {
  if (!headers) return undefined
  const target = name.toLowerCase()
  const found = Object.entries(headers).find(([key]) => key.toLowerCase() === target)
  if (!found) return undefined
  const value = found[1]
  if (Array.isArray(value)) return value.join(', ')
  return value
}

function logMediaResponse(details: {
  method: string
  statusCode: number
  url: string
  responseHeaders?: ResponseHeaders
}, window: BrowserWindow | null): void {
  if (!DEBUG_LOGS) return
  if (!isLikelyMediaResponse(details.url)) return
  const payload: MediaResponseDebug = {
    statusCode: details.statusCode,
    method: details.method,
    url: redactLogUrl(details.url).slice(0, 180),
    contentType: readHeader(details.responseHeaders, 'content-type'),
    contentLength: readHeader(details.responseHeaders, 'content-length'),
    contentRange: readHeader(details.responseHeaders, 'content-range'),
    acceptRanges: readHeader(details.responseHeaders, 'accept-ranges'),
    location: readHeader(details.responseHeaders, 'location')
      ? redactLogUrl(readHeader(details.responseHeaders, 'location') ?? '').slice(0, 180)
      : undefined,
  }
  console.warn('[main] MEDIA/RESPONSE', payload)
  window?.webContents.send('network-debug', payload)
}

function debugLogMediaRequest(
  method: string,
  url: string,
  auth: EmbyAuthState,
  headers: Record<string, string>,
): void {
  debugLog(
    `[main] MEDIA/EMBY-WEB ${method} ${redactLogUrl(url).slice(0, 180)}`,
    {
      serverOrigin: auth.serverOrigin,
      ua: headers['User-Agent'] ?? headers['user-agent'],
      embyAuth: headers['X-Emby-Authorization'] ? 'present' : 'media-query-auth',
      token: headers['X-Emby-Token'] ? 'present' : 'media-query-auth',
      secFetchDest: headers['Sec-Fetch-Dest'] ?? headers['sec-fetch-dest'],
      secFetchMode: headers['Sec-Fetch-Mode'] ?? headers['sec-fetch-mode'],
      secFetchSite: headers['Sec-Fetch-Site'] ?? headers['sec-fetch-site'],
      referer: headers['Referer'] ?? headers['referer'],
      range: headers['Range'] ?? headers['range'],
    },
  )
}

function debugLog(...args: unknown[]): void {
  if (DEBUG_LOGS) console.warn(...args)
}

function redactLogUrl(url: string): string {
  if (!URL.canParse(url)) return url
  const parsed = new URL(url)
  for (const key of ['api_key', 'DeviceId', 'device_id', 'session_id']) {
    if (parsed.searchParams.has(key)) parsed.searchParams.set(key, 'redacted')
  }
  return parsed.toString()
}
