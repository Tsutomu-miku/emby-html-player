import { useEffect, useRef } from 'react'
import type { PlayMethod, PlaybackProgressEvent } from '@/api/types'
import {
  reportPlaybackStart,
  reportPlaybackProgress,
  reportPlaybackStop,
} from '@/api/playback'
import { markPlayed } from '@/api/library'
import { secondsToTicks, throttle } from '@/utils'

/**
 * 把 HTMLVideoElement 的 buffered TimeRanges 转换成 Emby 需要的 BufferRangeDto[]
 */
function collectBufferedRanges(video: HTMLVideoElement): PlaybackProgressEvent['bufferedRanges'] {
  const out: PlaybackProgressEvent['bufferedRanges'] = []
  if (!video.buffered) return out
  for (let i = 0; i < video.buffered.length; i++) {
    out.push({
      start: secondsToTicks(video.buffered.start(i)),
      end: secondsToTicks(video.buffered.end(i)),
    })
  }
  return out
}

function logReportingFailure(action: string, err: unknown): void {
  console.warn(`[playback/reporting] ${action} failed`, err)
}

export interface UsePlaybackReportingParams {
  itemId: string
  mediaSourceId?: string
  playSessionId?: string
  audioStreamIndex?: number
  subtitleStreamIndex?: number
  video: HTMLVideoElement | null
  playMethod?: PlayMethod
  /** 可选：用于 markPlayed 调用 */
  userId?: string
}

/**
 * 监听 video 事件，向 Emby 服务器上报播放状态（开始 / 进度 / 停止）。
 * - timeupdate 节流 10s
 * - playing 仅首次触发 Start（自维护 hasStarted flag，避免 seek 后再触发）
 * - 组件卸载 / 页面 pagehide 会确保发出 Stop
 */
export function usePlaybackReporting(params: UsePlaybackReportingParams): void {
  const {
    itemId,
    mediaSourceId,
    playSessionId,
    audioStreamIndex,
    subtitleStreamIndex,
    video,
    playMethod,
    userId,
  } = params

  // 用 ref 保存最新值，避免闭包陈旧
  const latestRef = useRef({
    itemId,
    mediaSourceId,
    playSessionId,
    audioStreamIndex,
    subtitleStreamIndex,
    playMethod,
    userId,
  })
  latestRef.current = {
    itemId,
    mediaSourceId,
    playSessionId,
    audioStreamIndex,
    subtitleStreamIndex,
    playMethod,
    userId,
  }

  // 播放开始是否已经上报过（video.playing 会被触发多次）
  const hasStartedRef = useRef(false)
  // 最后一次 currentTime，用于 cleanup 时 reportPlaybackStop
  const lastPositionTicksRef = useRef(0)

  useEffect(() => {
    if (!video) return

    // 标记：新的 video / 新的 itemId 需要重新触发 Start
    hasStartedRef.current = false

    const commonProgress = (): PlaybackProgressEvent => {
      const cur = latestRef.current
      return {
        itemId: cur.itemId,
        playSessionId: cur.playSessionId,
        mediaSourceId: cur.mediaSourceId,
        audioStreamIndex: cur.audioStreamIndex,
        subtitleStreamIndex: cur.subtitleStreamIndex,
        playMethod: cur.playMethod,
        positionTicks: secondsToTicks(video.currentTime),
        isPaused: video.paused,
        isMuted: video.muted,
        volumeLevel: Math.round(video.volume * 100),
        bufferedRanges: collectBufferedRanges(video),
      }
    }

    /**
     * 必需字段齐了才发，否则 Emby 会 400：
     *   "Value cannot be null. (Parameter 'key')"
     * 典型触发路径：
     *   - video 刚挂载、currentUrl/playSessionId 尚未注入时，会抛一次 currentTime=0
     *     的 timeupdate，这时 cur.mediaSourceId / cur.playSessionId 还是 undefined，
     *     对应 Progress 里字段是 null，Emby 按 Dict key 查表直接抛。
     *   - 切源瞬间 mediaSourceId 先换成下一个、itemId 还没对应上也会出现窗口。
     * 解决：itemId + mediaSourceId + playSessionId 任一缺就不发，等下一次。
     */
    const canReport = (): boolean => {
      const cur = latestRef.current
      return !!cur.itemId && !!cur.mediaSourceId && !!cur.playSessionId
    }

    const sendProgress = () => {
      if (!hasStartedRef.current || !canReport()) return
      lastPositionTicksRef.current = secondsToTicks(video.currentTime)
      void reportPlaybackProgress(commonProgress()).catch((err: unknown) => {
        logReportingFailure('progress', err)
      })
    }

    const throttledProgress = throttle(sendProgress, 10_000)

    const onPlaying = () => {
      if (!canReport()) return
      const cur = latestRef.current
      lastPositionTicksRef.current = secondsToTicks(video.currentTime)
      if (!hasStartedRef.current) {
        hasStartedRef.current = true
        void reportPlaybackStart({
          ...commonProgress(),
          playbackStartTimeTicks: secondsToTicks(video.currentTime),
          playSessionId: cur.playSessionId,
        }).catch((err: unknown) => {
          logReportingFailure('start', err)
        })
      } else {
        // 从 seek / pause 恢复也算一次 progress（不节流）
        sendProgress()
      }
    }

    const onTimeUpdate = () => {
      if (!canReport()) return
      lastPositionTicksRef.current = secondsToTicks(video.currentTime)
      throttledProgress()
    }

    const onEnded = async () => {
      if (!hasStartedRef.current || !canReport()) return
      // 先把最后一次进度发出去
      try {
        await reportPlaybackProgress(commonProgress())
      } catch (err) {
        logReportingFailure('final progress', err)
      }
      try {
        await reportPlaybackStop(commonProgress())
      } catch (err) {
        logReportingFailure('stop', err)
      }
      if (latestRef.current.userId && latestRef.current.itemId) {
        void markPlayed(latestRef.current.userId, latestRef.current.itemId).catch((err: unknown) => {
          logReportingFailure('mark played', err)
        })
      }
    }

    const onPageHide = () => {
      if (!hasStartedRef.current || !canReport()) return
      // 页面关闭 / 切后台：最后一次尽力上报 stop
      const cur = latestRef.current
      const positionTicks = video.currentTime
        ? secondsToTicks(video.currentTime)
        : lastPositionTicksRef.current
      void reportPlaybackStop({
        itemId: cur.itemId,
        playSessionId: cur.playSessionId,
        mediaSourceId: cur.mediaSourceId,
        audioStreamIndex: cur.audioStreamIndex,
        subtitleStreamIndex: cur.subtitleStreamIndex,
        playMethod: cur.playMethod,
        positionTicks,
        isPaused: true,
      }).catch((err: unknown) => {
        logReportingFailure('pagehide stop', err)
      })
    }

    const onEndedListener: EventListener = () => { void onEnded() }

    video.addEventListener('playing', onPlaying)
    video.addEventListener('timeupdate', onTimeUpdate)
    video.addEventListener('pause', sendProgress)
    video.addEventListener('seeking', sendProgress)
    video.addEventListener('ratechange', sendProgress)
    video.addEventListener('volumechange', sendProgress)
    video.addEventListener('enterpictureinpicture', sendProgress)
    video.addEventListener('leavepictureinpicture', sendProgress)
    video.addEventListener('ended', onEndedListener)
    window.addEventListener('pagehide', onPageHide)

    return () => {
      video.removeEventListener('playing', onPlaying)
      video.removeEventListener('timeupdate', onTimeUpdate)
      video.removeEventListener('pause', sendProgress)
      video.removeEventListener('seeking', sendProgress)
      video.removeEventListener('ratechange', sendProgress)
      video.removeEventListener('volumechange', sendProgress)
      video.removeEventListener('enterpictureinpicture', sendProgress)
      video.removeEventListener('leavepictureinpicture', sendProgress)
      video.removeEventListener('ended', onEndedListener)
      window.removeEventListener('pagehide', onPageHide)

      // 组件卸载时，若 video 还存在，发一次 stop（确保服务端知道）
      if (!hasStartedRef.current || !canReport()) return
      const cur = latestRef.current
      void reportPlaybackStop({
        itemId: cur.itemId,
        playSessionId: cur.playSessionId,
        mediaSourceId: cur.mediaSourceId,
        audioStreamIndex: cur.audioStreamIndex,
        subtitleStreamIndex: cur.subtitleStreamIndex,
        playMethod: cur.playMethod,
        positionTicks: lastPositionTicksRef.current,
        isPaused: true,
      }).catch((err: unknown) => {
        logReportingFailure('cleanup stop', err)
      })
    }
    // 依赖只包含 video；其他参数用 ref 读取
  }, [video])
}

// 导出给外部使用 throttle.cancel 不会报错
