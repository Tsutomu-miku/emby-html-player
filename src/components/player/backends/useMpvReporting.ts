import { useEffect, useRef } from 'react'
import type { PlayMethod } from '@/api/types'
import {
  reportPlaybackProgress,
  reportPlaybackStart,
  reportPlaybackStop,
} from '@/api/playback'
import { secondsToTicks } from '@/utils'
import type { PlayerControl } from './control'

interface UseMpvReportingParams {
  enabled: boolean
  itemId: string
  mediaSourceId?: string
  playSessionId?: string
  audioStreamIndex?: number
  subtitleStreamIndex?: number
  control?: PlayerControl
  playMethod?: PlayMethod
  userId?: string
}

export function useMpvReporting(params: UseMpvReportingParams): void {
  const {
    enabled,
    itemId,
    mediaSourceId,
    playSessionId,
    audioStreamIndex,
    subtitleStreamIndex,
    control,
    playMethod,
  } = params
  const startedRef = useRef(false)
  const lastTicksRef = useRef(0)
  const lastProgressAtRef = useRef(0)
  const latestRef = useRef(params)
  latestRef.current = params

  useEffect(() => {
    if (!enabled || !control) return
    if (!control.started) return
    const canReport = !!itemId && !!mediaSourceId && !!playSessionId
    if (!canReport) return
    const body = () => ({
      itemId,
      mediaSourceId,
      playSessionId,
      audioStreamIndex,
      subtitleStreamIndex,
      playMethod,
      positionTicks: secondsToTicks(control.currentTime),
      isPaused: control.paused,
      isMuted: control.muted,
      volumeLevel: Math.round(control.volume * 100),
    })
    lastTicksRef.current = secondsToTicks(control.currentTime)
    if (!startedRef.current && !control.paused) {
      startedRef.current = true
      void reportPlaybackStart({
        ...body(),
        playbackStartTimeTicks: secondsToTicks(control.currentTime),
      }).catch((err: unknown) => logReportingFailure('mpv start', err))
      return
    }
    if (!startedRef.current) return
    const now = Date.now()
    if (now - lastProgressAtRef.current < 10_000) return
    lastProgressAtRef.current = now
    void reportPlaybackProgress(body()).catch((err: unknown) => {
      logReportingFailure('mpv progress', err)
    })
  }, [
    audioStreamIndex,
    control,
    enabled,
    itemId,
    mediaSourceId,
    playMethod,
    playSessionId,
    subtitleStreamIndex,
  ])

  useEffect(() => {
    return () => {
      const cur = latestRef.current
      if (!startedRef.current || !cur.enabled || !cur.playSessionId || !cur.mediaSourceId) return
      void reportPlaybackStop({
        itemId: cur.itemId,
        playSessionId: cur.playSessionId,
        mediaSourceId: cur.mediaSourceId,
        audioStreamIndex: cur.audioStreamIndex,
        subtitleStreamIndex: cur.subtitleStreamIndex,
        playMethod: cur.playMethod,
        positionTicks: lastTicksRef.current,
        isPaused: true,
      }).catch((err: unknown) => logReportingFailure('mpv cleanup stop', err))
    }
  }, [])
}

function logReportingFailure(action: string, err: unknown): void {
  console.warn(`[playback/reporting] ${action} failed`, err)
}
