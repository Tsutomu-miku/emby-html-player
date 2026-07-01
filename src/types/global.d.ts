/**
 * 渲染进程全局类型声明。
 *
 * `window.ehp` 由 electron/preload 通过 contextBridge.exposeInMainWorld 暴露，
 * 类型与 preload 导出的 EhpApi 保持结构一致。这里不直接 import preload 模块，
 * 避免 renderer 类型检查时拉入 electron 运行时依赖。
 */
import type { MediaSourceInfo, MediaStream, PlayMethod } from '@/api/types'

export {}

interface NetworkDebugEvent {
  statusCode: number
  method: string
  url: string
  contentType?: string
  contentLength?: string
  contentRange?: string
  acceptRanges?: string
  location?: string
}

interface MpvBounds {
  x: number
  y: number
  width: number
  height: number
}

interface MpvEvent {
  type:
    | 'ready'
    | 'metadata'
    | 'started'
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
  mediaSources?: MediaSourceInfo[]
  currentMediaSourceId?: string
  audioStreams?: MediaStream[]
  currentAudioIndex?: number
  subtitleStreams?: MediaStream[]
  currentSubtitleIndex?: number | null
  playMethod?: PlayMethod
  playbackRate?: number
  hasPrev?: boolean
  hasNext?: boolean
  action?: 'back' | 'prev' | 'next' | 'media-source'
  value?: string
  message?: string
  level?: string
  prefix?: string
}

declare global {
  interface Window {
    ehp: {
      platform: string
      versions: {
        electron: string
        chrome: string
        node: string
      }
      /** 同步当前 Emby 服务器 origin 给主进程，兼容旧入口 */
      setServerOrigin: (origin: string) => void
      /** 同步当前 Emby 鉴权信息给主进程，用于 API 与媒体流统一伪装成 Emby 播放器 */
      setEmbyAuth: (auth: { server: string; accessToken: string; deviceId: string }) => void
      mpvCreate: (payload: { bounds: MpvBounds; itemId: string }) => Promise<void>
      mpvLoad: (payload: {
        url: string
        title?: string
        headers?: Record<string, string>
        startSeconds?: number
      }) => Promise<void>
      mpvCommand: (payload: { command: string; args?: unknown[] }) => Promise<void>
      mpvDestroy: () => Promise<void>
      onMpvEvent: (listener: (event: MpvEvent) => void) => () => void
      /** 把主进程媒体响应摘要转发到 renderer console，便于从 DevTools 直接贴日志 */
      onNetworkDebug: (listener: (event: NetworkDebugEvent) => void) => () => void
    }
  }
}
