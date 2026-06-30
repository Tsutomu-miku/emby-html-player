// hls.js 错误处理 + 媒体挂载逻辑
// 把 currentUrl effect 里的大段逻辑拆出来
import Hls from 'hls.js'
import type { PlayMethod } from '@/api/types'

export interface HlsAttachResult {
  hls: Hls | null
  /** 致命错误，调用方应当 setError */
  fatal?: { message: string }
}

/**
 * 把 URL 挂载到 video 上：
 * - HLS URL（m3u8 或 Transcode）：Safari 原生优先，否则用 hls.js
 * - 非 HLS：直接 video.src
 *
 * 返回 Hls 实例（用于后续 destroy）+ 致命错误（如果有）
 */
export function attachSourceToVideo(
  video: HTMLVideoElement,
  url: string,
  playMethod: PlayMethod | undefined,
  onFatalError: (msg: string) => void,
): Hls | null {
  const isHls = /\.m3u8(\?|$)/i.test(url) || playMethod === 'Transcode'
  const canNative = !!video.canPlayType('application/vnd.apple.mpegurl').replace(/^no$/, '')

  if (!isHls) {
    video.src = url
    video.load()
    return null
  }

  if (canNative) {
    video.src = url
    video.load()
    return null
  }

  if (!Hls.isSupported()) {
    onFatalError('当前浏览器不支持 HLS 播放')
    return null
  }

  const hls = new Hls({
    enableWorker: true,
    lowLatencyMode: false,
    maxBufferLength: 30,
    backBufferLength: 60,
  })
  let networkRecoveryCount = 0
  let mediaRecoveryCount = 0
  hls.attachMedia(video)
  hls.loadSource(url)
  hls.on(Hls.Events.MANIFEST_PARSED, () => {
    void video.play().catch((e: unknown) => {
      console.warn('[hls] autoplay blocked or failed', e instanceof Error ? e.message : e)
    })
  })
  hls.on(Hls.Events.ERROR, (_e, data) => {
    console.warn('[hls] error', {
      type: data.type,
      details: data.details,
      fatal: data.fatal,
      url: data.url?.slice(0, 200),
      responseCode: data.response?.code,
    })
    if (!data.fatal) return
    switch (data.type) {
      case Hls.ErrorTypes.NETWORK_ERROR:
        if (data.response?.code === 401 || data.response?.code === 403 || data.response?.code === 404) {
          onFatalError(`HLS 网络错误：${data.details ?? data.type}（HTTP ${data.response.code}）`)
          return
        }
        if (networkRecoveryCount < 1) {
          networkRecoveryCount += 1
          hls.startLoad()
          return
        }
        onFatalError(`HLS 网络错误：${data.details ?? data.type}${data.response?.code ? `（HTTP ${data.response.code}）` : ''}`)
        break
      case Hls.ErrorTypes.MEDIA_ERROR:
        if (mediaRecoveryCount < 1) {
          mediaRecoveryCount += 1
          hls.recoverMediaError()
          return
        }
        onFatalError(`HLS 媒体错误：${data.details ?? data.type}`)
        break
      default:
        onFatalError(`HLS 错误：${data.details ?? data.type}`)
    }
  })
  return hls
}
