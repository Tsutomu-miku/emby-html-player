// Preload 脚本：通过 contextBridge 暴露安全 API 给渲染进程
import { contextBridge, ipcRenderer } from 'electron'

export interface NetworkDebugEvent {
  statusCode: number
  method: string
  url: string
  contentType?: string
  contentLength?: string
  contentRange?: string
  acceptRanges?: string
  location?: string
}

export interface MpvBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface MpvEvent {
  type:
    | 'ready'
    | 'loading'
    | 'metadata'
    | 'started'
    | 'rendered'
    | 'time'
    | 'duration'
    | 'paused'
    | 'network'
    | 'ended'
    | 'error'
    | 'log'
    | 'ui-action'
  seconds?: number
  paused?: boolean
  bytesPerSecond?: number
  title?: string
  mediaSources?: unknown[]
  currentMediaSourceId?: string
  audioStreams?: unknown[]
  currentAudioIndex?: number
  subtitleStreams?: unknown[]
  currentSubtitleIndex?: number | null
  playMethod?: string
  playbackRate?: number
  hasPrev?: boolean
  hasNext?: boolean
  action?: 'back' | 'prev' | 'next' | 'media-source'
  value?: string
  message?: string
  level?: string
  prefix?: string
}

const api = {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  /**
   * 把当前已登录的 Emby 服务器与鉴权信息同步给主进程。
   *
   * 主进程的 webRequest 拦截器据此给 API、server 媒体、CDN 跳转媒体统一加 Emby
   * 播放器身份；渲染进程无法可靠修改 User-Agent，所以必须在主进程完成。
   */
  setServerOrigin: (origin: string) => ipcRenderer.send('set-server-origin', origin),
  setEmbyAuth: (auth: { server: string; accessToken: string; deviceId: string }) =>
    ipcRenderer.send('set-emby-auth', auth),
  mpvCreate: (payload: { bounds: MpvBounds; itemId: string }) =>
    ipcRenderer.invoke('mpv-create', payload) as Promise<void>,
  mpvLoad: (payload: {
    url: string
    title?: string
    headers?: Record<string, string>
    startSeconds?: number
  }) => ipcRenderer.invoke('mpv-load', payload) as Promise<void>,
  mpvCommand: (payload: { command: string; args?: unknown[] }) =>
    ipcRenderer.invoke('mpv-command', payload) as Promise<void>,
  mpvDestroy: () => ipcRenderer.invoke('mpv-destroy') as Promise<void>,
  onMpvEvent: (listener: (event: MpvEvent) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: MpvEvent) => {
      listener(payload)
    }
    ipcRenderer.on('mpv-event', wrapped)
    return () => ipcRenderer.removeListener('mpv-event', wrapped)
  },
  onNetworkDebug: (listener: (event: NetworkDebugEvent) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: NetworkDebugEvent) => {
      listener(payload)
    }
    ipcRenderer.on('network-debug', wrapped)
    return () => ipcRenderer.removeListener('network-debug', wrapped)
  },
} as const

contextBridge.exposeInMainWorld('ehp', api)

export type EhpApi = typeof api
