// 字幕挂载 + textTrack.mode 同步逻辑
import { getSubtitleUrl } from '@/api/playback'
import type { MediaSourceInfo, MediaStream } from '@/api/types'
import { isTextSubtitle } from './selectors'

/** 给 video 元素挂载所有可外挂的文本字幕 <track> */
export function mountExternalSubtitles(
  video: HTMLVideoElement,
  src: MediaSourceInfo,
  itemId: string,
  selectedSubtitleIndex: number | null,
) {
  const subtitleStreams = (src.mediaStreams || []).filter((s) => s.type === 'Subtitle')
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
  syncTextTrackMode(video, selectedSubtitleIndex)
}

/** 把 video.textTracks 的 mode 同步到当前选中字幕 */
export function syncTextTrackMode(
  video: HTMLVideoElement,
  selectedSubtitleIndex: number | null,
) {
  const trackEls = video.querySelectorAll<HTMLTrackElement>('track[data-index]')
  let matched: TextTrack | null = null
  trackEls.forEach((te) => {
    if (parseInt(te.dataset.index || '-1', 10) === selectedSubtitleIndex) matched = te.track
  })
  for (let i = 0; i < video.textTracks.length; i++) {
    video.textTracks[i].mode = video.textTracks[i] === matched ? 'showing' : 'disabled'
  }
}

/** 卸载所有已挂载的字幕 <track>（切源前调用） */
export function unmountAllSubtitles(video: HTMLVideoElement) {
  const oldTracks = video.querySelectorAll('track')
  oldTracks.forEach((t) => t.remove())
}

/** 给外挂字幕应用字体缩放：动态注入 scoped ::cue style */
export function applySubtitleFontScale(
  container: HTMLDivElement,
  scale: number,
) {
  const styleId = 'ehp-cue-font-scale'
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null
  if (!styleEl) {
    styleEl = document.createElement('style')
    styleEl.id = styleId
    document.head.appendChild(styleEl)
  }
  const clamped = Math.max(0.7, Math.min(2.0, scale))
  if (!container.id) {
    container.id = `ehp-player-${Math.random().toString(36).slice(2)}`
  }
  styleEl.textContent =
    clamped === 1
      ? ''
      : `#${container.id} video::cue { font-size: ${Math.round(clamped * 100)}%; line-height: 1.3; }`
  if (clamped === 1 && styleEl) styleEl.textContent = ''
}

/** 兼容旧调用名（Player 重构后保留导出） */
export type SubtitleStream = MediaStream
