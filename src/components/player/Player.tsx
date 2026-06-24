import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Hls from 'hls.js'
import type { BaseItemDto, MediaSourceInfo, MediaStream, PlayMethod } from '@/api/types'
import {
  buildDeviceProfile,
  getPlaybackInfo,
  resolveMediaPlayback,
  getSubtitleUrl,
  closeLiveStream,
} from '@/api/playback'
import { useAuthStore } from '@/store/auth'
import { getItem } from '@/api/library'
import { cx, debounce } from '@/utils'
import { secondsToTicks, ticksToSeconds, clamp } from '@/utils/time'
import { Controls } from './Controls'
import { usePlaybackReporting } from '@/hooks/usePlaybackReporting'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useMediaSession } from '@/hooks/useMediaSession'

export interface PlayerProps {
  itemId: string
  startPositionTicks?: number
  seriesId?: string
  defaultAudioIndex?: number
  /** null = 关闭字幕；undefined = 选默认字幕 */
  defaultSubtitleIndex?: number | null
  defaultMediaSourceId?: string
  className?: string
  /** 自然播放结束时触发 */
  onEnded?: () => void
  /** 播放剩余 N 秒时触发一次（不重复） */
  onBeforeEnded?: (secondsLeft: number) => void
  beforeEndedThresholdSeconds?: number
  children?: React.ReactNode
}

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

interface PlayerError {
  message: string
  fatal?: boolean
}

/** 字幕流是否支持浏览器外挂（文本类） */
function isTextSubtitle(s: MediaStream): boolean {
  const c = (s.codec || '').toLowerCase()
  if (/pgs|dvdsub|subrip_vobsub|vobsub/.test(c)) return false
  if (c === '') return true
  return /subrip|srt|vtt|webvtt|ass|ssa|ttml|txt|sub/.test(c)
}

/**
 * 从一组 MediaSource 里挑选默认源：
 *  优先级：supportsDirectPlay && bitrate 合理 → supportsDirectStream → supportsTranscoding → 第一个
 */
function pickDefaultSource(sources: MediaSourceInfo[], preferId?: string): MediaSourceInfo | undefined {
  if (!sources.length) return undefined
  if (preferId) {
    const found = sources.find((s) => s.id === preferId)
    if (found) return found
  }
  // 直接播放（带直链 URL 优先）
  const dp = sources.filter((s) => s.supportsDirectPlay)
  if (dp.length) {
    // 优先有 URL 的，其次 bitrate 中间值（不选超大的 4K 源除非只有它）
    const ordered = [...dp].sort((a, b) => {
      const aHas = a.directStreamUrl ? 0 : 1
      const bHas = b.directStreamUrl ? 0 : 1
      if (aHas !== bHas) return aHas - bHas
      const ab = a.bitrate ?? 0
      const bb = b.bitrate ?? 0
      // 介于 1-30 Mbps 更合理
      const score = (br: number) => (br >= 1e6 && br <= 30e6 ? 0 : Math.abs(br - 8e6))
      return score(ab) - score(bb)
    })
    return ordered[0]
  }
  const ds = sources.filter((s) => s.supportsDirectStream)
  if (ds.length) return ds[0]
  const tr = sources.filter((s) => s.supportsTranscoding)
  if (tr.length) return tr[0]
  return sources[0]
}

function pickDefaultAudio(
  streams: MediaStream[],
  preferred?: number,
  mediaSourceDefaultIndex?: number | null,
): number {
  if (preferred != null) {
    const idx = streams.findIndex((s) => s.index === preferred)
    if (idx >= 0) return preferred
  }
  if (mediaSourceDefaultIndex != null) {
    if (streams.some((s) => s.index === mediaSourceDefaultIndex)) return mediaSourceDefaultIndex
  }
  const def = streams.find((s) => s.isDefault)
  if (def) return def.index
  return streams[0]?.index ?? 0
}

function pickDefaultSubtitle(
  streams: MediaStream[],
  preferred: number | null | undefined,
): number | null {
  // null = 明确关闭；number = 指定；undefined = 找默认
  if (preferred === null) return null
  if (typeof preferred === 'number') {
    if (streams.some((s) => s.index === preferred)) return preferred
    return null
  }
  // 默认字幕：非 forced 的 default；否则返回 null（用户未指定时默认不开启，避免打扰）
  const def = streams.find((s) => s.isDefault && !s.isForced)
  if (def) return def.index
  return null
}

/** 从 MediaSource 中提取特定类型的流 */
function filterStreams(mediaStreams: MediaStream[], type: 'Audio' | 'Video' | 'Subtitle'): MediaStream[] {
  return mediaStreams.filter((s) => s.type === type)
}

/* ======== 主组件 ======== */
export function Player(props: PlayerProps) {
  const {
    itemId,
    startPositionTicks,
    seriesId,
    defaultAudioIndex,
    defaultSubtitleIndex,
    defaultMediaSourceId,
    className,
    onEnded,
    onBeforeEnded,
    beforeEndedThresholdSeconds = 40,
    children,
  } = props

  const userId = useAuthStore((s) => s.userId)
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const liveStreamIdRef = useRef<string | undefined>(undefined)
  const playSessionIdRef = useRef<string | undefined>(undefined)

  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [error, setError] = useState<PlayerError | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const [playbackInfoMediaSources, setPlaybackInfoMediaSources] = useState<MediaSourceInfo[]>([])
  const [selectedMediaSource, setSelectedMediaSource] = useState<MediaSourceInfo | undefined>()
  const [selectedAudioIndex, setSelectedAudioIndex] = useState<number | undefined>()
  const [selectedSubtitleIndex, setSelectedSubtitleIndex] = useState<number | null>(null)
  const [playMethod, setPlayMethod] = useState<PlayMethod | undefined>()
  const [currentUrl, setCurrentUrl] = useState<string | undefined>()
  const [liveStreamId, setLiveStreamId] = useState<string | undefined>()
  const [playbackRate, setPlaybackRate] = useState(1)
  const [playSessionId, setPlaySessionId] = useState<string | undefined>()
  const [resolvedStartTicks, setResolvedStartTicks] = useState<number>(0)
  const [itemInfo, setItemInfo] = useState<
    | Pick<
        BaseItemDto,
        'id' | 'name' | 'type' | 'indexNumber' | 'parentIndexNumber' | 'seriesName' | 'seasonName' | 'imageTags'
      >
    | null
  >(null)

  // 控制条显示
  const [controlsVisible, setControlsVisible] = useState(true)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 上一集 / 下一集（由父级或 Player 内部计算，目前暴露给父级注入；这里默认都无）
  const [hasPrev, setHasPrev] = useState(false)
  const [hasNext, setHasNext] = useState(false)
  // 提供给父级（PlayerPage）调用
  const prevHandlerRef = useRef<(() => void) | undefined>(undefined)
  const nextHandlerRef = useRef<(() => void) | undefined>(undefined)
  // 给外部绑定：父级通过 props.children 下面给 Player 注入 handler 时用下面 setters
  const setPrevHandler = (fn?: () => void) => {
    prevHandlerRef.current = fn ?? undefined
  }
  const setNextHandler = (fn?: () => void) => {
    nextHandlerRef.current = fn ?? undefined
  }
  // 暴露方法给父组件（通过 ref）的简化：我们通过自定义事件不太好做 —— 这里用 Player 暴露的 dom data 属性 + 自定义 window event
  // 更简单：PlayerPage 自己找 onPrev/onNext；这里提供 hasPrev/hasNext 的 setter
  void seriesId

  // beforeEnded 标记
  const beforeEndedFiredRef = useRef(false)

  /* ========== 控制条可见性：移动/按键/播放暂停时显示，2.5s 静止隐藏（仅播放中） ========== */
  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => {
      const v = videoRef.current
      if (v && !v.paused) setControlsVisible(false)
    }, 2500)
  }, [])

  const bumpVisibility = useCallback(() => {
    setControlsVisible(true)
    scheduleHide()
  }, [scheduleHide])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onMove = debounce(() => bumpVisibility(), 100)
    const onLeave = () => {
      const v = videoRef.current
      if (v && !v.paused) {
        // 鼠标移出容器后也让隐藏生效，但延迟长一点
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
        hideTimerRef.current = setTimeout(() => setControlsVisible(false), 1500)
      }
    }
    const onClick = (e: MouseEvent) => {
      // 只在点击视频区域本身时 toggle（移动端）
      const t = e.target as HTMLElement
      if (t.tagName === 'VIDEO') {
        const v = videoRef.current
        if (v) {
          if (v.paused) void v.play().catch(() => {})
          else v.pause()
        }
      }
    }
    const onTouchEnd = (e: TouchEvent) => {
      const t = e.target as HTMLElement
      if (t.tagName === 'VIDEO') {
        // 移动端点击视频区 toggle 控制条（不打断播放）
        setControlsVisible((v) => !v)
      }
    }
    const onPlay = () => {
      bumpVisibility()
    }
    const onPause = () => {
      setControlsVisible(true)
    }
    const onKey = () => bumpVisibility()

    el.addEventListener('mousemove', onMove as unknown as EventListener)
    el.addEventListener('mouseleave', onLeave)
    el.addEventListener('click', onClick)
    el.addEventListener('touchend', onTouchEnd)
    window.addEventListener('keydown', onKey)
    const v = videoRef.current
    v?.addEventListener('play', onPlay)
    v?.addEventListener('pause', onPause)

    return () => {
      el.removeEventListener('mousemove', onMove as unknown as EventListener)
      el.removeEventListener('mouseleave', onLeave)
      el.removeEventListener('click', onClick)
      el.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('keydown', onKey)
      v?.removeEventListener('play', onPlay)
      v?.removeEventListener('pause', onPause)
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [bumpVisibility])

  /* ========== Toast ========== */
  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 2500)
  }, [])

  /* ========== 字幕切换 ========== */
  // 把已挂载的 <track> 与 当前 selectedSubtitleIndex 同步：仅 external 模式生效
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const tracks = video.textTracks
    if (!tracks) return
    const targetIndex = selectedSubtitleIndex
    for (let i = 0; i < tracks.length; i++) {
      const tt = tracks[i]
      // dataIndex 是我们给每个 track 元素设置的 dataset['index']，但 textTrack 对象本身没有
      // 我们通过 DOM 上的 <track> 对应的 textTrack 通过 DOM 查询的方式获取
    }
    // 更可靠的方式：通过 DOM 上的 <track> 元素查找
    const trackEls = video.querySelectorAll<HTMLTrackElement>('track[data-index]')
    let matched: TextTrack | null = null
    trackEls.forEach((t) => {
      const tIdx = parseInt(t.dataset.index || '-1', 10)
      if (tIdx === targetIndex) matched = t.track
    })
    for (let i = 0; i < tracks.length; i++) {
      tracks[i].mode = tracks[i] === matched ? 'showing' : 'disabled'
    }
  }, [selectedSubtitleIndex, currentUrl])

  /* ========== 流程 1：加载 getItem + getPlaybackInfo ========== */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const doLoad = useCallback(
    async (opts: {
      newMediaSourceId?: string
      overrideAudioIndex?: number
      overrideSubtitleIndex?: number | null
      subtitleMode?: 'external' | 'encode'
      /** 保留 position 用的当前秒数（来自当前 video） */
      resumeSeconds?: number
    } = {}) => {
      const { newMediaSourceId, overrideAudioIndex, overrideSubtitleIndex, subtitleMode, resumeSeconds } = opts
      setLoadState('loading')
      setError(null)

      try {
        // 1) 取用户上次位置（仅首次；切源时用 resumeSeconds）
        let startTicks = 0
        if (resumeSeconds != null) {
          startTicks = secondsToTicks(resumeSeconds)
        } else if (startPositionTicks != null) {
          startTicks = startPositionTicks
        } else {
          try {
            const itm = await getItem(userId, itemId)
            startTicks = itm.userData?.playbackPositionTicks ?? 0
            setItemInfo({
              id: itm.id,
              name: itm.name,
              type: itm.type,
              indexNumber: itm.indexNumber,
              parentIndexNumber: itm.parentIndexNumber,
              seriesName: itm.seriesName,
              seasonName: itm.seasonName,
              imageTags: itm.imageTags,
            })
          } catch {
            /* ignore */
          }
        }

        const audioIdx = overrideAudioIndex ?? defaultAudioIndex
        let subtitleIdx: number | undefined
        if (subtitleMode === 'encode' && typeof overrideSubtitleIndex === 'number') {
          subtitleIdx = overrideSubtitleIndex
        } else if (defaultSubtitleIndex !== undefined && defaultSubtitleIndex !== null) {
          subtitleIdx = defaultSubtitleIndex
        }
        setResolvedStartTicks(startTicks)

        // 2) getPlaybackInfo
        const info = await getPlaybackInfo(userId, itemId, newMediaSourceId ?? defaultMediaSourceId, {
          deviceProfile: buildDeviceProfile(),
          startTimeTicks: startTicks,
          audioStreamIndex: audioIdx,
          subtitleStreamIndex: subtitleIdx,
        })
        if (info.errorCode) {
          throw new Error(`PlaybackInfo 返回错误：${info.errorCode}`)
        }
        if (!info.mediaSources?.length) {
          throw new Error('服务器未返回任何可用媒体源')
        }
        setPlaybackInfoMediaSources(info.mediaSources)
        setPlaySessionId(info.playSessionId)
        playSessionIdRef.current = info.playSessionId

        // 3) 选择 source / audio / subtitle
        const src = pickDefaultSource(info.mediaSources, newMediaSourceId ?? defaultMediaSourceId)
        if (!src) throw new Error('无法挑选默认媒体源')
        setSelectedMediaSource(src)

        const audioStreams = filterStreams(src.mediaStreams, 'Audio')
        const subtitleStreams = filterStreams(src.mediaStreams, 'Subtitle')

        const finalAudio = pickDefaultAudio(
          audioStreams,
          overrideAudioIndex ?? defaultAudioIndex,
          // mediaSource.defaultAudioStreamIndex 在类型里不存在；尝试从原始数据读取
          (src as MediaSourceInfo & { defaultAudioStreamIndex?: number }).defaultAudioStreamIndex ?? null,
        )
        setSelectedAudioIndex(finalAudio)

        // 字幕默认：encode 模式按 encode 来；external 按 defaultSubtitleIndex
        let finalSubtitle: number | null
        if (overrideSubtitleIndex !== undefined) {
          finalSubtitle = overrideSubtitleIndex
        } else {
          finalSubtitle = pickDefaultSubtitle(subtitleStreams, defaultSubtitleIndex)
        }
        setSelectedSubtitleIndex(finalSubtitle)

        // 4) resolveMediaPlayback（encode 字幕时需要 subtitleStreamIndex）
        const resolved = resolveMediaPlayback({
          itemId,
          mediaSource: src,
          userId,
          playSessionId: info.playSessionId,
          audioStreamIndex: finalAudio,
          subtitleStreamIndex: subtitleMode === 'encode' && typeof finalSubtitle === 'number' ? finalSubtitle : undefined,
          startTimeTicks: startTicks,
        })
        setCurrentUrl(resolved.url)
        setPlayMethod(resolved.method)
        setLiveStreamId(resolved.liveStreamId)
        liveStreamIdRef.current = resolved.liveStreamId

        setLoadState('ready')
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setError({ message: msg, fatal: true })
        setLoadState('error')
      }
    },
    [itemId, userId, startPositionTicks, defaultMediaSourceId, defaultAudioIndex, defaultSubtitleIndex],
  )

  // 首次挂载加载
  useEffect(() => {
    void doLoad()
  }, [doLoad])

  /* ========== 流程 6：绑定 video 源 ========== */
  useEffect(() => {
    if (!currentUrl) return
    const video = videoRef.current
    if (!video) return

    // 清理：destroy 旧 hls / close 旧 liveStream / 清 src
    const cleanup = () => {
      if (hlsRef.current) {
        try {
          hlsRef.current.destroy()
        } catch {
          /* ignore */
        }
        hlsRef.current = null
      }
      try {
        video.pause()
      } catch {
        /* ignore */
      }
      video.removeAttribute('src')
      try {
        video.load()
      } catch {
        /* ignore */
      }
    }

    const prevLive = liveStreamIdRef.current
    if (prevLive) {
      void closeLiveStream(prevLive).catch(() => {})
      liveStreamIdRef.current = undefined
    }
    cleanup()
    if (liveStreamId) liveStreamIdRef.current = liveStreamId

    const isHls = /\.m3u8(\?|$)/i.test(currentUrl) || playMethod === 'Transcode'
    const canNative = !!video.canPlayType('application/vnd.apple.mpegurl').replace(/^no$/, '')

    let cancelled = false
    const doAttach = () => {
      if (cancelled) return
      if (isHls) {
        if (canNative) {
          video.src = currentUrl
          video.load()
        } else if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
            maxBufferLength: 30,
            backBufferLength: 60,
          })
          hlsRef.current = hls
          hls.attachMedia(video)
          hls.loadSource(currentUrl)
          hls.on(Hls.Events.ERROR, (_e, data) => {
            if (cancelled) return
            if (data.fatal) {
              // 致命错误，进入错误态
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  void (async () => {
                    try {
                      hls.startLoad()
                      return
                    } catch {
                      /* fallback 到 error */
                    }
                    setError({
                      message: `HLS 网络错误：${data.details ?? data.type}`,
                      fatal: true,
                    })
                    setLoadState('error')
                  })()
                  break
                case Hls.ErrorTypes.MEDIA_ERROR:
                  try {
                    hls.recoverMediaError()
                    return
                  } catch {
                    /* ignore */
                  }
                  setError({
                    message: `HLS 媒体错误：${data.details ?? data.type}`,
                    fatal: true,
                  })
                  setLoadState('error')
                  break
                default:
                  setError({
                    message: `HLS 错误：${data.details ?? data.type}`,
                    fatal: true,
                  })
                  setLoadState('error')
              }
            }
          })
        } else {
          setError({ message: '当前浏览器不支持 HLS 播放', fatal: true })
          setLoadState('error')
        }
      } else {
        // mp4/webm 直链
        video.src = currentUrl
        video.load()
      }
    }

    // 先清除所有旧的 <track>，再在 metadata 后重新挂载
    // 在 src 设置前先移除旧 tracks
    const oldTracks = video.querySelectorAll('track')
    oldTracks.forEach((t) => t.remove())

    // loadedmetadata 后：保留起始位置，挂载 external 字幕
    const onLoadedMeta = () => {
      if (cancelled) return
      const startSec = ticksToSeconds(resolvedStartTicks)
      if (startSec > 1 && video.duration > startSec) {
        try {
          video.currentTime = startSec
        } catch {
          /* ignore */
        }
      }
      // 挂 external 字幕
      const src = selectedMediaSource
      if (!src) return
      const subtitleStreams = filterStreams(src.mediaStreams, 'Subtitle')
      subtitleStreams.forEach((s) => {
        if (!isTextSubtitle(s)) return
        const t = document.createElement('track')
        t.kind = 'subtitles'
        t.label = s.displayTitle || s.language || `字幕 ${s.index}`
        t.srclang = s.language || 'und'
        t.src = getSubtitleUrl({
          itemId,
          mediaSourceId: src.id,
          subtitleStreamIndex: s.index,
          format: 'vtt',
        })
        t.dataset.index = String(s.index)
        if (s.index === selectedSubtitleIndex) t.default = true
        video.appendChild(t)
      })
      // 手动触发一次同步 textTrack.mode
      const trackEls = video.querySelectorAll<HTMLTrackElement>('track[data-index]')
      const target = selectedSubtitleIndex
      let matched: TextTrack | null = null
      trackEls.forEach((te) => {
        if (parseInt(te.dataset.index || '-1', 10) === target) matched = te.track
      })
      for (let i = 0; i < video.textTracks.length; i++) {
        video.textTracks[i].mode = video.textTracks[i] === matched ? 'showing' : 'disabled'
      }
    }
    video.addEventListener('loadedmetadata', onLoadedMeta, { once: true })

    const onVideoError = () => {
      const e = video.error
      const msg = e ? `视频播放错误 (code=${e.code})：${e.message || '未知错误'}` : '视频播放错误'
      setError({ message: msg, fatal: true })
      setLoadState('error')
    }
    video.addEventListener('error', onVideoError)

    // 下一帧执行，确保 effect cleanup 完成
    const id = window.setTimeout(doAttach, 0)

    // ended
    const onEndedH = () => {
      beforeEndedFiredRef.current = false // 为下一次播放复位
      onEnded?.()
    }
    video.addEventListener('ended', onEndedH)

    // beforeEnded 监听
    const onTimeU = () => {
      if (!video.duration || !isFinite(video.duration)) return
      const left = video.duration - video.currentTime
      if (!beforeEndedFiredRef.current && left > 0 && left <= beforeEndedThresholdSeconds) {
        beforeEndedFiredRef.current = true
        onBeforeEnded?.(left)
      }
    }
    video.addEventListener('timeupdate', onTimeU)

    return () => {
      cancelled = true
      window.clearTimeout(id)
      video.removeEventListener('loadedmetadata', onLoadedMeta)
      video.removeEventListener('error', onVideoError)
      video.removeEventListener('ended', onEndedH)
      video.removeEventListener('timeupdate', onTimeU)
      cleanup()
      const curLive = liveStreamIdRef.current
      if (curLive) {
        void closeLiveStream(curLive).catch(() => {})
        liveStreamIdRef.current = undefined
      }
    }
    // 依赖 currentUrl 即可，其他（起始位置）应在 currentUrl 变后触发一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUrl])

  /* ========== 流程 7：上报 ========== */
  usePlaybackReporting({
    itemId,
    mediaSourceId: selectedMediaSource?.id,
    playSessionId,
    audioStreamIndex: selectedAudioIndex,
    subtitleStreamIndex: selectedSubtitleIndex ?? undefined,
    video: videoRef.current,
    playMethod,
    userId,
  })

  /* ========== 快捷键 ========== */
  const subtitleStreams = useMemo(
    () => filterStreams(selectedMediaSource?.mediaStreams ?? [], 'Subtitle'),
    [selectedMediaSource],
  )
  const cycleSubtitles = useCallback(() => {
    if (!subtitleStreams.length) return
    const external = subtitleStreams.filter((s) => isTextSubtitle(s))
    if (!external.length) return
    if (selectedSubtitleIndex == null) {
      handleSubtitleChange(external[0].index, 'external')
      return
    }
    const idx = external.findIndex((s) => s.index === selectedSubtitleIndex)
    if (idx < 0) {
      handleSubtitleChange(external[0].index, 'external')
    } else if (idx >= external.length - 1) {
      handleSubtitleChange(null, 'external')
    } else {
      handleSubtitleChange(external[idx + 1].index, 'external')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubtitleIndex, subtitleStreams])

  useKeyboardShortcuts(
    {
      video: videoRef.current,
      container: containerRef.current,
      hasPrev,
      hasNext,
      onPrev: () => prevHandlerRef.current?.(),
      onNext: () => nextHandlerRef.current?.(),
      playbackRate,
      setPlaybackRate,
      cycleSubtitles,
    },
    true,
  )

  useMediaSession({
    item: itemInfo,
    video: videoRef.current,
    hasPrev,
    hasNext,
    onPrev: () => prevHandlerRef.current?.(),
    onNext: () => nextHandlerRef.current?.(),
  })

  /* ========== 切源 / 切音轨 / 切字幕 ========== */
  const handleMediaSourceChange = useCallback(
    (id: string) => {
      const cur = videoRef.current
      const resumeSec = cur?.currentTime ?? 0
      void doLoad({
        newMediaSourceId: id,
        overrideAudioIndex: selectedAudioIndex,
        overrideSubtitleIndex: selectedSubtitleIndex,
        resumeSeconds: resumeSec,
      })
    },
    [doLoad, selectedAudioIndex, selectedSubtitleIndex],
  )

  const handleAudioChange = useCallback(
    (index: number) => {
      // 切音轨：
      //  - DirectPlay/DirectStream：尝试 video.audioTracks；
      //  - 不可用时提示用户，并引导到转码；
      //  - Transcode：重新 getPlaybackInfo + 换源
      if (playMethod === 'Transcode') {
        const resumeSec = videoRef.current?.currentTime ?? 0
        setSelectedAudioIndex(index)
        void doLoad({
          overrideAudioIndex: index,
          overrideSubtitleIndex: selectedSubtitleIndex,
          resumeSeconds: resumeSec,
        })
        return
      }
      // 非转码：尝试 audioTracks
      // eslint-disable-next-line @typescript-eslint/no-empty-object-type
      type AnyAudioTrackList = { length: number; [i: number]: { enabled: boolean; language?: string } }
      const v = videoRef.current
      const v2 = v as HTMLVideoElement & { audioTracks?: AnyAudioTrackList }
      if (v && v2.audioTracks && typeof v2.audioTracks === 'object') {
        const tracks = v2.audioTracks
        const src = selectedMediaSource
        const audios = src ? filterStreams(src.mediaStreams, 'Audio') : []
        const targetStream = audios.find((s) => s.index === index)
        if (tracks.length > 0 && targetStream) {
          // 用 language 匹配尽力而为
          let changed = false
          for (let i = 0; i < tracks.length; i++) {
            const t = tracks[i]
            const isMatch =
              t.language && targetStream.language && t.language.toLowerCase() === targetStream.language.toLowerCase()
            t.enabled = !isMatch ? false : (changed = true, true)
          }
          if (changed) {
            setSelectedAudioIndex(index)
            return
          }
        }
      }
      // 不支持：提示 + 引导切到转码
      setSelectedAudioIndex(index)
      showToast('当前播放源不支持切换音轨，尝试切换到转码源…')
      // 找一个支持转码的源 id
      const ts = playbackInfoMediaSources.find((s) => s.supportsTranscoding)?.id
      const resumeSec = videoRef.current?.currentTime ?? 0
      void doLoad({
        newMediaSourceId: ts,
        overrideAudioIndex: index,
        overrideSubtitleIndex: selectedSubtitleIndex,
        resumeSeconds: resumeSec,
      })
    },
    [playMethod, selectedMediaSource, playbackInfoMediaSources, selectedSubtitleIndex, doLoad, showToast],
  )

  const handleSubtitleChange = useCallback(
    (index: number | null, mode: 'external' | 'encode') => {
      // idx = null → 直接关
      if (index == null) {
        setSelectedSubtitleIndex(null)
        // 如果当前是 encode 模式（带字幕烧录），为了停止烧录需要重新切源
        if (playMethod === 'Transcode' && selectedSubtitleIndex != null) {
          const resumeSec = videoRef.current?.currentTime ?? 0
          void doLoad({
            overrideAudioIndex: selectedAudioIndex,
            overrideSubtitleIndex: null,
            resumeSeconds: resumeSec,
          })
        }
        return
      }
      // external 模式
      if (mode === 'external') {
        // 只有文本字幕才能 external
        const src = selectedMediaSource
        const sub = src?.mediaStreams.find((s) => s.type === 'Subtitle' && s.index === index)
        if (!sub) return
        if (!isTextSubtitle(sub)) {
          showToast('该字幕为位图字幕，不支持外挂模式，将使用烧录')
          // 自动回落到 encode
          handleSubtitleChange(index, 'encode')
          return
        }
        setSelectedSubtitleIndex(index)
        return
      }
      // encode 模式：重新 getPlaybackInfo + resolve
      setSelectedSubtitleIndex(index)
      const resumeSec = videoRef.current?.currentTime ?? 0
      void doLoad({
        overrideAudioIndex: selectedAudioIndex,
        overrideSubtitleIndex: index,
        subtitleMode: 'encode',
        resumeSeconds: resumeSec,
      })
    },
    [playMethod, selectedSubtitleIndex, selectedMediaSource, doLoad, selectedAudioIndex, showToast],
  )

  /* ========== 错误：重试 / 下一个源 ========== */
  const retry = () => void doLoad()
  const nextSource = () => {
    if (!playbackInfoMediaSources.length) return retry()
    const curIdx = playbackInfoMediaSources.findIndex((s) => s.id === selectedMediaSource?.id)
    const next = playbackInfoMediaSources[(curIdx + 1) % playbackInfoMediaSources.length]
    handleMediaSourceChange(next.id)
  }

  /* ========== 暴露给父组件 ========== */
  useEffect(() => {
    // 设置 data-set 属性方便外部使用
    const el = containerRef.current
    if (!el) return
    // 我们通过自定义事件暴露 setHandlers
    ;(el as HTMLDivElement & {
      __playerBindHandlers?: (opt: {
        hasPrev?: boolean
        hasNext?: boolean
        onPrev?: () => void
        onNext?: () => void
      }) => void
    }).__playerBindHandlers = (opt) => {
      if (opt.hasPrev !== undefined) setHasPrev(opt.hasPrev)
      if (opt.hasNext !== undefined) setHasNext(opt.hasNext)
      if (opt.onPrev !== undefined) setPrevHandler(opt.onPrev)
      if (opt.onNext !== undefined) setNextHandler(opt.onNext)
    }
    const ev = new CustomEvent('player-ready', { detail: { itemId } })
    el.dispatchEvent(ev)
  }, [itemId])

  /* ========== 派生数据 ========== */
  const audioStreams = useMemo(
    () => filterStreams(selectedMediaSource?.mediaStreams ?? [], 'Audio'),
    [selectedMediaSource],
  )

  /* ========== 渲染 ========== */
  const hasOtherSource = playbackInfoMediaSources.length > 1

  return (
    <div
      ref={containerRef}
      className={cx(
        'relative bg-black rounded-xl overflow-hidden aspect-video w-full shadow-2xl group',
        'ring-1 ring-white/5',
        className,
      )}
    >
      <video
        ref={videoRef}
        playsInline
        preload="metadata"
        crossOrigin="anonymous"
        className="w-full h-full bg-black"
        onRateChange={() => {
          const v = videoRef.current
          if (v && v.playbackRate !== playbackRate) setPlaybackRate(v.playbackRate)
        }}
      />

      <Controls
        video={videoRef.current}
        container={containerRef.current}
        item={itemInfo ?? undefined}
        mediaSources={playbackInfoMediaSources}
        currentMediaSourceId={selectedMediaSource?.id}
        onMediaSourceChange={handleMediaSourceChange}
        audioStreams={audioStreams}
        currentAudioIndex={selectedAudioIndex}
        onAudioChange={handleAudioChange}
        subtitleStreams={subtitleStreams}
        currentSubtitleIndex={selectedSubtitleIndex}
        onSubtitleChange={handleSubtitleChange}
        playbackRate={playbackRate}
        onPlaybackRateChange={(r) => {
          setPlaybackRate(r)
          if (videoRef.current) videoRef.current.playbackRate = r
        }}
        hasPrev={hasPrev}
        hasNext={hasNext}
        onPrev={() => prevHandlerRef.current?.()}
        onNext={() => nextHandlerRef.current?.()}
        show={controlsVisible}
        playMethod={playMethod}
        onBack={() => {
          if (typeof window !== 'undefined' && window.history.length > 1) window.history.back()
        }}
      />

      {/* 父组件覆盖层（下一集卡片等） */}
      {children}

      {/* Toast */}
      {toast ? (
        <div className="absolute left-1/2 top-12 -translate-x-1/2 px-4 py-2 rounded-md bg-black/80 text-white text-sm shadow-lg z-30 pointer-events-none">
          {toast}
        </div>
      ) : null}

      {/* Loading */}
      {loadState === 'loading' && (
        <OverlayLoading />
      )}

      {/* Error */}
      {loadState === 'error' && error ? (
        <OverlayError
          message={error.message}
          hasOther={hasOtherSource}
          onRetry={retry}
          onNext={nextSource}
        />
      ) : null}
    </div>
  )
}

/* ======== 覆盖层：Loading ======== */
function OverlayLoading() {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-[1px]">
      <div className="flex flex-col items-center gap-4 text-white/80">
        <div
          className="w-10 h-10 rounded-full border-2 border-white/20 border-t-jelly-accent animate-spin"
          aria-label="加载中"
        />
        <div className="text-sm">准备播放…</div>
      </div>
    </div>
  )
}

/* ======== 覆盖层：Error ======== */
function OverlayError(props: {
  message: string
  hasOther: boolean
  onRetry: () => void
  onNext: () => void
}) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-6">
      <div className="max-w-md w-full rounded-xl bg-jelly-card/90 ring-1 ring-white/10 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-500/15 text-red-300 flex items-center justify-center text-xl">
            !
          </div>
          <div>
            <div className="text-white font-semibold text-base">播放失败</div>
            <div className="text-white/60 text-xs mt-0.5 break-all">{props.message}</div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={props.onRetry}
            className="btn flex-1 min-w-[7rem]"
          >
            重试
          </button>
          {props.hasOther ? (
            <button
              type="button"
              onClick={props.onNext}
              className="btn-ghost flex-1 min-w-[10rem]"
            >
              切换到下一个源
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/* 帮助函数绑定一下 clamp 到导出引用，避免未使用 */
void clamp

export type { PlayMethod, MediaSourceInfo, MediaStream, BaseItemDto }
