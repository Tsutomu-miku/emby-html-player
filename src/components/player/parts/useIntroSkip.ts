// 片头/片尾自动跳过逻辑（timeupdate 节流 500ms）
// 抽成独立 hook，让 Player.tsx 主组件保持精简
import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

interface IntroSkipSettings {
  enableIntroSkip: boolean
  introSkipStartSeconds: number
  introSkipEndSeconds: number
  introSkipUseKeywordDetect: boolean
  enableCreditsSkip: boolean
  creditsSkipThresholdSeconds: number
}

interface UseIntroSkipOpts extends IntroSkipSettings {
  videoRef: RefObject<HTMLVideoElement | null>
  hasNext: boolean
  showToast: (msg: string) => void
  /** 倒计时触发回调（Player 内部传 onBeforeEnded） */
  onNearEnd: () => void
  /** 距离末尾多少秒触发 onNearEnd */
  nearEndThreshold: number
}

export function useIntroSkip(opts: UseIntroSkipOpts) {
  const {
    videoRef,
    hasNext,
    showToast,
    onNearEnd,
    nearEndThreshold,
    enableIntroSkip,
    introSkipStartSeconds,
    introSkipEndSeconds,
    introSkipUseKeywordDetect,
    enableCreditsSkip,
    creditsSkipThresholdSeconds,
  } = opts

  const showIntroBtnRef = useRef(false)
  const introAutoSeekedRef = useRef(false)
  const creditsAutoSeekedRef = useRef(false)
  const beforeEndedFiredRef = useRef(false)

  // 暴露给 Player 在切源时复位
  const reset = () => {
    showIntroBtnRef.current = false
    introAutoSeekedRef.current = false
    creditsAutoSeekedRef.current = false
    beforeEndedFiredRef.current = false
  }

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let lastTick = 0

    const onTimeU = () => {
      if (!video.duration || !isFinite(video.duration)) return
      const now = performance.now()
      const doThrottled = now - lastTick >= 500
      if (!doThrottled) {
        const left = video.duration - video.currentTime
        if (!beforeEndedFiredRef.current && left > 0 && left <= nearEndThreshold) {
          beforeEndedFiredRef.current = true
          onNearEnd()
        }
        return
      }
      lastTick = now

      const cur = video.currentTime
      const dur = video.duration
      const left = dur - cur
      if (!beforeEndedFiredRef.current && left > 0 && left <= nearEndThreshold) {
        beforeEndedFiredRef.current = true
        onNearEnd()
      }
      if (enableIntroSkip && !introAutoSeekedRef.current) {
        const a = Math.max(0, introSkipStartSeconds || 0)
        const b = Math.max(a, introSkipEndSeconds || 0)
        if (b - a > 2 && cur >= a && cur <= b) {
          if (introSkipUseKeywordDetect) {
            try {
              video.currentTime = b + 0.1
              introAutoSeekedRef.current = true
              showToast('⏭ 已自动跳过片头')
            } catch {
              /* ignore - seek 失败说明视频流问题，让 timeupdate 自然继续 */
            }
          } else if (!showIntroBtnRef.current) {
            showIntroBtnRef.current = true
            showToast('⏭ 按 N 或点我立即跳过片头')
          }
        }
      }
      if (enableCreditsSkip && !creditsAutoSeekedRef.current) {
        const thresh = creditsSkipThresholdSeconds || 60
        if (left > 0 && left <= thresh && hasNext) {
          creditsAutoSeekedRef.current = true
          try {
            video.currentTime = Math.max(0, dur - 0.2)
          } catch {
            /* ignore */
          }
        }
      }
    }
    video.addEventListener('timeupdate', onTimeU)
    return () => video.removeEventListener('timeupdate', onTimeU)
  }, [
    videoRef,
    hasNext,
    showToast,
    onNearEnd,
    nearEndThreshold,
    enableIntroSkip,
    introSkipStartSeconds,
    introSkipEndSeconds,
    introSkipUseKeywordDetect,
    enableCreditsSkip,
    creditsSkipThresholdSeconds,
  ])

  return { reset }
}
