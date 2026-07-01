// Electron 主进程入口：创建窗口 + 注入 CORS 头 + 注册 IPC
import { app, BrowserWindow, ipcMain, session, shell } from 'electron'
import path from 'node:path'
import {
  applyEmbyApiIdentity,
  applyEmbyMediaIdentity,
  emptyEmbyAuth,
  EMBY_USER_AGENT,
  isMediaRequest,
  isServerRequest,
  normalizeOrigin,
  parseEmbyAuth,
  type EmbyAuthState,
} from './embyIdentity'
import { installEmbeddedMpvIpc } from './embeddedMpv'

// Node 20.11+ / Electron 31+ 原生支持 import.meta.dirname；
// electron-vite 5 在构建时会自动注入 __dirname shim，此处不要重复声明，避免重复绑定。
const __dir = import.meta.dirname

// 开发环境渲染进程地址（electron-vite dev 启动）
const DEV_SERVER_URL = process.env['ELECTRON_RENDERER_URL'] ?? ''
const isDev = !!DEV_SERVER_URL
const DEBUG_LOGS = process.env['EHP_DEBUG_LOGS'] === '1'
const REMOTE_DEBUGGING_PORT = process.env['EHP_REMOTE_DEBUGGING_PORT']

if (isDev && REMOTE_DEBUGGING_PORT) {
  app.commandLine.appendSwitch('remote-debugging-port', REMOTE_DEBUGGING_PORT)
}

let mainWindow: BrowserWindow | null = null
let embyAuth: EmbyAuthState = emptyEmbyAuth()

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

function redactLogUrl(url: string): string {
  if (!URL.canParse(url)) return url
  const parsed = new URL(url)
  for (const key of ['api_key', 'DeviceId', 'device_id', 'session_id']) {
    if (parsed.searchParams.has(key)) parsed.searchParams.set(key, 'redacted')
  }
  return parsed.toString()
}

function logMediaResponse(details: {
  method: string
  statusCode: number
  url: string
  responseHeaders?: ResponseHeaders
}): void {
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
  mainWindow?.webContents.send('network-debug', payload)
}

function debugLog(...args: unknown[]): void {
  if (DEBUG_LOGS) console.warn(...args)
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: 'Emby Desktop Player',
    backgroundColor: '#101114',
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dir, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  // 外链点击用系统浏览器打开，不在 Electron 内跳转
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      void shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })

  if (isDev) {
    await mainWindow.loadURL(DEV_SERVER_URL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    await mainWindow.loadFile(path.join(__dir, '../renderer/index.html'))
  }
}

/**
 * 安装网络拦截器，解决两个问题：
 *   1) CORS：渲染进程（localhost:5173 或 file://）跨域请求 Emby 服务器。
 *      对 OPTIONS 预检，在 onHeadersReceived 里用 statusLine 把响应强制改成 204 + CORS 头，
 *      不管 CF/Emby 原本返回什么（403/500/…），Chromium 看到的永远是合法预检响应。
 *   2) Emby 身份：渲染进程 fetch / video 不能可靠改 User-Agent，
 *      在 onBeforeSendHeaders 统一改成 Emby 播放器身份。
 */
function installNetworkHandlers() {
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

  // 关键：onHeadersReceived 能覆写 statusLine（HTTP 状态码）。
  // 对 OPTIONS 预检，不管远端返回 403 还是别的，统一改成 204 + 完整 CORS 头。
  // 这是解决 "Response to preflight doesn't have HTTP ok status" 的根本方法。
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
      })
    }
    // 非 OPTIONS：注入 CORS 头到实际响应
    const headers = { ...(details.responseHeaders ?? {}), ...corsHeaders }
    callback({ responseHeaders: headers })
  })

  // 伪装成 Emby 播放器是所有外部请求的最高优先级：
  // - server API：Emby UA + X-Emby-*，同时剥离浏览器指纹头。
  // - server 媒体 / CDN 跳转媒体：官方 Emby Web 的浏览器视频请求形态。
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    if (!isExternalHttpUrl(details.url)) {
      callback({})
      return
    }
    const isServer = isServerRequest(details.url, embyAuth)
    const isServerMedia = isServer && isMediaRequest(details.url)
    const isRedirectedMedia =
      !isServer && embyAuth.serverOrigin.length > 0 && details.resourceType === 'media'
    if (isServerMedia || isMediaRequest(details.url) || isRedirectedMedia) {
      const baseHeaders = { ...(details.requestHeaders ?? {}) }
      const headers = applyEmbyMediaIdentity(baseHeaders, embyAuth, details.url)
      debugLog(
        `[main] MEDIA/EMBY-WEB ${details.method} ${redactLogUrl(details.url).slice(0, 180)}`,
        {
          serverOrigin: embyAuth.serverOrigin,
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
      callback({ requestHeaders: headers })
      return
    }
    if (!isServer) {
      callback({ requestHeaders: details.requestHeaders })
      return
    }
    const reqHeaders = applyEmbyApiIdentity(details.requestHeaders ?? {}, embyAuth)
    debugLog(
      `[main] SERVER/EMBY ${details.method} ${redactLogUrl(details.url).slice(0, 180)} UA=${EMBY_USER_AGENT}`,
    )
    callback({ requestHeaders: reqHeaders })
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

void app.whenReady().then(() => {
  // 兼容旧入口：只更新 server origin，完整身份由 set-emby-auth 同步。
  ipcMain.on('set-server-origin', (_e, origin: unknown) => {
    if (typeof origin !== 'string') {
      console.warn('[main] set-server-origin received non-string', origin)
      return
    }
    embyAuth = { ...embyAuth, serverOrigin: normalizeOrigin(origin) }
    debugLog(`[main] serverOrigin updated -> ${embyAuth.serverOrigin}`)
  })

  ipcMain.on('set-emby-auth', (_e, payload: unknown) => {
    const parsed = parseEmbyAuth(payload)
    if (!parsed) {
      console.warn('[main] set-emby-auth received invalid payload', payload)
      return
    }
    embyAuth = parsed
    debugLog(`[main] embyAuth updated -> ${embyAuth.serverOrigin}`, {
      token: embyAuth.accessToken ? 'present' : 'missing',
      deviceId: embyAuth.deviceId ? 'present' : 'missing',
    })
  })

  installEmbeddedMpvIpc(() => mainWindow, () => embyAuth)

  installNetworkHandlers()
  void createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
