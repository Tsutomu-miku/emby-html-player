import { BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import { buildEmbyNativeMediaHeaders, type EmbyAuthState } from './embyIdentity'
import {
  mergeLoadMetadata,
  readBoundsArg,
  readMetadataArg,
  readOverlayActionArg,
  type MetadataEvent,
} from './embeddedMpvArgs'
import { LibMpvBackend } from './libMpvBackend'
import type {
  EmbeddedMpvBackend,
  MpvEvent,
  MpvCommandRequest,
  MpvCreateRequest,
  MpvLoadRequest,
} from './mpvTypes'

const DEBUG_LOGS = process.env['EHP_DEBUG_LOGS'] === '1'
const DEV_SERVER_URL = process.env['ELECTRON_RENDERER_URL'] ?? ''
const __dir = import.meta.dirname

interface PlaybackSnapshot {
  started: boolean
  rendered: boolean
  currentTime: number
  duration: number
  paused: boolean
  bytesPerSecond: number
}

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
  private overlayWindow: BrowserWindow | null = null
  private ownerWindow: BrowserWindow | null = null
  private readonly destroyOnOwnerClose = () => {
    void this.destroy()
  }
  private metadataSnapshot: MetadataEvent = { type: 'metadata', title: '' }
  private playbackSnapshot: PlaybackSnapshot = createInitialPlaybackSnapshot()

  constructor(
    private readonly getWindow: () => BrowserWindow | null,
    private readonly getAuth: () => EmbyAuthState,
    private readonly backend: EmbeddedMpvBackend,
  ) {}

  async create(payload: MpvCreateRequest): Promise<void> {
    const window = this.requireWindow()
    this.bindOwnerWindow(window)
    this.playbackSnapshot = createInitialPlaybackSnapshot()
    this.backend.setEventCallback((event) => {
      this.sendEvent(event)
    })
    await this.backend.create({
      windowHandle: nativeHandleToPointerString(window.getNativeWindowHandle()),
      bounds: payload.bounds,
      itemId: payload.itemId,
    })
    await this.createOverlay(window, payload.bounds)
  }

  async load(payload: MpvLoadRequest): Promise<void> {
    const headers = buildEmbyNativeMediaHeaders(this.getAuth())
    this.playbackSnapshot = createInitialPlaybackSnapshot()
    this.sendEvent({ type: 'loading' })
    this.sendEvent(mergeLoadMetadata(this.metadataSnapshot, payload.title ?? ''))
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
    if (payload.command === 'request-overlay-metadata') {
      this.sendOverlaySnapshot()
      return
    }
    if (payload.command === 'set-overlay-metadata') {
      this.sendEvent(readMetadataArg(payload))
      return
    }
    if (payload.command === 'overlay-action') {
      this.sendEvent(readOverlayActionArg(payload))
      return
    }
    if (payload.command === 'set-overlay-interactive') {
      this.setOverlayInteractive(readBooleanArg(payload))
      return
    }
    await this.backend.command(payload)
    if (payload.command === 'set-bounds') {
      const window = this.requireWindow()
      this.moveOverlay(window, readBoundsArg(payload))
    }
  }

  async destroy(): Promise<void> {
    this.unbindOwnerWindow()
    await this.backend.destroy()
    this.playbackSnapshot = createInitialPlaybackSnapshot()
    this.destroyOverlay()
  }

  private requireWindow(): BrowserWindow {
    const window = this.getWindow()
    if (!window || window.isDestroyed()) throw new Error('MPV 播放窗口不存在')
    return window
  }

  private sendEvent(event: MpvEvent): void {
    this.rememberEvent(event)
    if (event.type === 'metadata') this.metadataSnapshot = event
    const window = this.getWindow()
    if (window && !window.isDestroyed()) window.webContents.send('mpv-event', event)
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.webContents.send('mpv-event', event)
    }
  }

  private async createOverlay(parent: BrowserWindow, bounds: MpvCreateRequest['bounds']): Promise<void> {
    this.destroyOverlay()
    const overlay = new BrowserWindow({
      parent,
      show: false,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      hasShadow: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      focusable: false,
      acceptFirstMouse: true,
      skipTaskbar: true,
      webPreferences: {
        preload: path.join(__dir, '../preload/index.mjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    })
    overlay.setMenuBarVisibility(false)
    this.overlayWindow = overlay
    this.setOverlayInteractive(false)
    this.moveOverlay(parent, bounds)
    if (DEV_SERVER_URL) {
      const url = new URL(DEV_SERVER_URL)
      url.searchParams.set('mpvOverlay', '1')
      await overlay.loadURL(url.toString())
    } else {
      await overlay.loadFile(path.join(__dir, '../renderer/index.html'), {
        search: 'mpvOverlay=1',
      })
    }
    if (!overlay.isDestroyed()) overlay.showInactive()
  }

  private moveOverlay(parent: BrowserWindow, bounds: MpvCreateRequest['bounds']): void {
    if (!this.overlayWindow || this.overlayWindow.isDestroyed()) return
    const content = parent.getContentBounds()
    this.overlayWindow.setBounds({
      x: content.x + Math.round(bounds.x),
      y: content.y + Math.round(bounds.y),
      width: Math.max(1, Math.round(bounds.width)),
      height: Math.max(1, Math.round(bounds.height)),
    })
  }

  private destroyOverlay(): void {
    const overlay = this.overlayWindow
    this.overlayWindow = null
    if (overlay && !overlay.isDestroyed()) overlay.close()
  }

  private bindOwnerWindow(window: BrowserWindow): void {
    if (this.ownerWindow === window) return
    this.unbindOwnerWindow()
    this.ownerWindow = window
    window.once('close', this.destroyOnOwnerClose)
  }

  private unbindOwnerWindow(): void {
    if (!this.ownerWindow) return
    this.ownerWindow.removeListener('close', this.destroyOnOwnerClose)
    this.ownerWindow = null
  }

  private setOverlayInteractive(interactive: boolean): void {
    if (!this.overlayWindow || this.overlayWindow.isDestroyed()) return
    this.overlayWindow.setIgnoreMouseEvents(!interactive, { forward: true })
  }

  private sendOverlaySnapshot(): void {
    this.sendEvent(this.metadataSnapshot)
    if (this.playbackSnapshot.started) this.sendEvent({ type: 'started' })
    if (this.playbackSnapshot.rendered) this.sendEvent({ type: 'rendered' })
    if (this.playbackSnapshot.duration > 0) {
      this.sendEvent({ type: 'duration', seconds: this.playbackSnapshot.duration })
    }
    if (this.playbackSnapshot.currentTime > 0) {
      this.sendEvent({ type: 'time', seconds: this.playbackSnapshot.currentTime })
    }
    this.sendEvent({ type: 'paused', paused: this.playbackSnapshot.paused })
    if (this.playbackSnapshot.bytesPerSecond > 0) {
      this.sendEvent({ type: 'network', bytesPerSecond: this.playbackSnapshot.bytesPerSecond })
    }
  }

  private rememberEvent(event: MpvEvent): void {
    switch (event.type) {
      case 'started':
        this.playbackSnapshot.started = true
        this.playbackSnapshot.paused = false
        break
      case 'rendered':
        this.playbackSnapshot.started = true
        this.playbackSnapshot.rendered = true
        break
      case 'time':
        this.playbackSnapshot.started = true
        this.playbackSnapshot.currentTime = event.seconds
        break
      case 'duration':
        this.playbackSnapshot.started = true
        this.playbackSnapshot.duration = event.seconds
        break
      case 'paused':
        this.playbackSnapshot.started = event.paused === false ? true : this.playbackSnapshot.started
        this.playbackSnapshot.paused = event.paused
        break
      case 'network':
        this.playbackSnapshot.bytesPerSecond = event.bytesPerSecond
        break
      case 'ended':
        this.playbackSnapshot.paused = true
        break
      case 'error':
      case 'log':
      case 'loading':
      case 'metadata':
      case 'ready':
      case 'ui-action':
        break
    }
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

function readBooleanArg(input: MpvCommandRequest): boolean {
  const value = input.args?.[0]
  if (typeof value !== 'boolean') throw new Error(`${input.command} 参数类型无效`)
  return value
}

function createInitialPlaybackSnapshot(): PlaybackSnapshot {
  return {
    started: false,
    rendered: false,
    currentTime: 0,
    duration: 0,
    paused: true,
    bytesPerSecond: 0,
  }
}
