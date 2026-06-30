import { BrowserWindow, ipcMain } from 'electron'
import { buildEmbyNativeMediaHeaders, type EmbyAuthState } from './embyIdentity'
import { LibMpvBackend } from './libMpvBackend'
import type {
  EmbeddedMpvBackend,
  MpvCommandRequest,
  MpvCreateRequest,
  MpvLoadRequest,
} from './mpvTypes'

const DEBUG_LOGS = process.env['EHP_DEBUG_LOGS'] === '1'

export function installEmbeddedMpvIpc(
  getWindow: () => BrowserWindow | null,
  getAuth: () => EmbyAuthState,
): void {
  const service = new EmbeddedMpvService(
    getWindow,
    getAuth,
    new LibMpvBackend(),
  )
  ipcMain.handle('mpv-create', (_event, payload: MpvCreateRequest) => service.create(payload))
  ipcMain.handle('mpv-load', (_event, payload: MpvLoadRequest) => service.load(payload))
  ipcMain.handle('mpv-command', (_event, payload: MpvCommandRequest) => service.command(payload))
  ipcMain.handle('mpv-destroy', () => service.destroy())
}

class EmbeddedMpvService {
  constructor(
    private readonly getWindow: () => BrowserWindow | null,
    private readonly getAuth: () => EmbyAuthState,
    private readonly backend: EmbeddedMpvBackend,
  ) {}

  async create(payload: MpvCreateRequest): Promise<void> {
    const window = this.requireWindow()
    this.backend.setEventCallback((event) => {
      window.webContents.send('mpv-event', event)
    })
    await this.backend.create({
      windowHandle: nativeHandleToPointerString(window.getNativeWindowHandle()),
      bounds: payload.bounds,
      itemId: payload.itemId,
    })
  }

  async load(payload: MpvLoadRequest): Promise<void> {
    const headers = buildEmbyNativeMediaHeaders(this.getAuth())
    if (DEBUG_LOGS) {
      console.warn('[main] MPV/EMBY load', {
        url: redactMediaUrl(payload.url).slice(0, 180),
        ua: headers['User-Agent'],
        embyAuth: headers['X-Emby-Authorization'] ? 'present' : 'missing',
        token: headers['X-Emby-Token'] ? 'present' : 'missing',
        referer: headers['Referer'] ? 'present' : 'missing',
        rendererHeadersIgnored: payload.headers ? Object.keys(payload.headers) : [],
      })
    }
    await this.backend.load({
      url: payload.url,
      title: payload.title,
      startSeconds: payload.startSeconds,
      headers,
    })
  }

  async command(payload: MpvCommandRequest): Promise<void> {
    await this.backend.command(payload)
  }

  async destroy(): Promise<void> {
    await this.backend.destroy()
  }

  private requireWindow(): BrowserWindow {
    const window = this.getWindow()
    if (!window || window.isDestroyed()) throw new Error('MPV 播放窗口不存在')
    return window
  }
}

function redactMediaUrl(url: string): string {
  if (!URL.canParse(url)) return url
  const parsed = new URL(url)
  if (parsed.searchParams.has('api_key')) parsed.searchParams.set('api_key', 'redacted')
  if (parsed.searchParams.has('DeviceId')) parsed.searchParams.set('DeviceId', 'redacted')
  if (parsed.searchParams.has('device_id')) parsed.searchParams.set('device_id', 'redacted')
  if (parsed.searchParams.has('session_id')) parsed.searchParams.set('session_id', 'redacted')
  return parsed.toString()
}

function nativeHandleToPointerString(handle: Buffer): string {
  if (handle.length < 8) throw new Error(`Electron native handle 长度异常：${handle.length}`)
  return handle.readBigUInt64LE(0).toString(10)
}
