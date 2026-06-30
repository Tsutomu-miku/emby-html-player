// Player 的"选源 / 选音轨 / 选字幕"决策逻辑
// 从 Player.tsx 抽出，保持纯函数 + 易测试
import type { MediaSourceInfo, MediaStream } from '@/api/types'
import {
  rankLanguageMatch,
  type BurnInSubtitlePolicy,
  type PlayMode as SettingsPlayMode,
  type SourceSelectionStrategy,
  type SubtitleAutoSelectPolicy,
} from '@/store/settings'

/** 字幕流是否支持浏览器外挂（文本类） */
export function isTextSubtitle(s: MediaStream): boolean {
  const c = (s.codec || '').toLowerCase()
  if (/pgs|dvdsub|subrip_vobsub|vobsub/.test(c)) return false
  if (c === '') return true
  return /subrip|srt|vtt|webvtt|ass|ssa|ttml|txt|sub/.test(c)
}

/** 从 MediaSource 中提取特定类型的流 */
export function filterStreams(
  mediaStreams: MediaStream[],
  type: 'Audio' | 'Video' | 'Subtitle',
): MediaStream[] {
  return mediaStreams.filter((s) => s.type === type)
}

function scoreSource(s: MediaSourceInfo, strategy: SourceSelectionStrategy): number {
  let score = 0
  if (s.supportsDirectPlay && s.directStreamUrl) score += 1000
  else if (s.supportsDirectStream) score += 800
  else if (s.supportsTranscoding) score += 600
  const br = s.bitrate ?? 0
  switch (strategy) {
    case 'quality':
      score += Math.min(br / 1_000_000, 200)
      break
    case 'size':
      score += br > 0 ? Math.max(0, 200 - br / 1_000_000) : 50
      break
    case 'balanced':
    default:
      if (br >= 4e6 && br <= 30e6) score += 150
      else if (br > 0) score += 80
      break
  }
  const audios = (s.mediaStreams || []).filter((x) => x.type === 'Audio').length
  const subs = (s.mediaStreams || []).filter((x) => x.type === 'Subtitle').length
  score += Math.min(audios, 4) * 3 + Math.min(subs, 6) * 2
  return score
}

/**
 * 按设置过滤（playMode：允许哪些 DirectPlay/DirectStream/Transcode），
 * 再按 sourceStrategy（quality / balanced / size）在候选里排序。
 */
export function pickDefaultSource(
  sources: MediaSourceInfo[],
  opts: {
    preferId?: string
    playMode?: SettingsPlayMode
    strategy?: SourceSelectionStrategy
  } = {},
): MediaSourceInfo | undefined {
  const { preferId, playMode = 'auto', strategy = 'balanced' } = opts
  if (!sources.length) return undefined
  const isAllowed = (s: MediaSourceInfo): boolean => {
    switch (playMode) {
      case 'direct-play':
        return !!s.supportsDirectPlay
      case 'direct-stream':
        return !!s.supportsDirectStream
      case 'transcode':
        return !!s.supportsTranscoding && !!s.transcodingUrl
      case 'auto':
      default:
        return true
    }
  }
  if (preferId) {
    const found = sources.find((s) => s.id === preferId && isAllowed(s))
    if (found) return found
  }
  const pool = sources.filter(isAllowed)
  if (!pool.length) return undefined
  const scored = pool.map((s) => ({ s, score: scoreSource(s, strategy) }))
  scored.sort((a, b) => b.score - a.score)
  return scored[0]?.s
}

export function pickDefaultAudio(
  streams: MediaStream[],
  opts: {
    preferredIndex?: number
    mediaSourceDefaultIndex?: number | null
    preferredLanguages: string[]
  },
): number {
  const { preferredIndex, mediaSourceDefaultIndex, preferredLanguages } = opts
  if (preferredIndex !== null && preferredIndex !== undefined) {
    const idx = streams.findIndex((s) => s.index === preferredIndex)
    if (idx >= 0) return preferredIndex
  }
  if (mediaSourceDefaultIndex !== null && mediaSourceDefaultIndex !== undefined) {
    if (streams.some((s) => s.index === mediaSourceDefaultIndex)) return mediaSourceDefaultIndex
  }
  if (!streams.length) return 0
  let best: { stream: MediaStream; rank: number } | undefined
  for (const s of streams) {
    const r = rankLanguageMatch(preferredLanguages, s.language || s.languageTag)
    const candidate = {
      stream: s,
      rank: r < 0 ? 999 : r + (s.isDefault ? -0.5 : 0),
    }
    if (!best || candidate.rank < best.rank) best = candidate
  }
  if (best && best.rank < 900) return best.stream.index
  const def = streams.find((s) => s.isDefault)
  if (def) return def.index
  return streams[0]?.index ?? 0
}

export function resolveDelivery(
  s: MediaStream,
  burnInPolicy: BurnInSubtitlePolicy,
): 'external' | 'encode' {
  const isText = isTextSubtitle(s)
  switch (burnInPolicy) {
    case 'always':
      return 'encode'
    case 'never':
      return 'external'
    case 'bitmap-only':
      return isText ? 'external' : 'encode'
    case 'auto':
    default:
      return isText ? 'external' : 'encode'
  }
}

export function pickDefaultSubtitle(
  streams: MediaStream[],
  opts: {
    preferred?: number | null
    preferredLanguages: string[]
    autoSelect: SubtitleAutoSelectPolicy
    burnInPolicy: BurnInSubtitlePolicy
    forcedOnly: boolean
    audioStream?: MediaStream
  },
): { index: number | null; delivery: 'external' | 'encode' } {
  const {
    preferred,
    preferredLanguages,
    autoSelect,
    burnInPolicy,
    forcedOnly,
    audioStream,
  } = opts
  if (preferred === null) return { index: null, delivery: 'external' }
  if (typeof preferred === 'number') {
    const s = streams.find((x) => x.index === preferred)
    if (s) return { index: preferred, delivery: resolveDelivery(s, burnInPolicy) }
    return { index: null, delivery: 'external' }
  }
  if (autoSelect === 'off') return { index: null, delivery: 'external' }

  let pool = streams.slice()
  if (forcedOnly) pool = pool.filter((s) => !!s.isForced)

  const audioLang = audioStream?.language || audioStream?.languageTag
  const isForeignAudio = (subLang: string | undefined) => {
    if (!audioLang || !subLang) return true
    const a = audioLang.toLowerCase()
    const s = subLang.toLowerCase()
    return !(a === s || a.startsWith(s) || s.startsWith(a))
  }

  const ranked = pool
    .map((s) => {
      const r = rankLanguageMatch(preferredLanguages, s.language || s.languageTag)
      const notMatch = r < 0
      const foreign = isForeignAudio(s.language || s.languageTag)
      const sdh = /sdh|cc|听障|hearing/i.test(`${s.title || ''} ${s.displayTitle || ''}`)
      let gate = 0
      switch (autoSelect) {
        case 'always':
          gate = 0
          break
        case 'smart':
          gate = foreign || sdh ? 0 : 100
          break
        case 'foreign':
          gate = foreign ? 0 : -1
          break
        case 'sdh':
          gate = sdh ? 0 : -1
          break
      }
      return {
        stream: s,
        rank:
          gate < 0
            ? Infinity
            : gate +
              (notMatch ? 10 : r) +
              (s.isDefault ? -0.5 : 0) +
              (s.isForced ? 0.5 : 0),
      }
    })
    .filter((x) => x.rank < Infinity)
    .sort((a, b) => a.rank - b.rank)
  if (!ranked.length) return { index: null, delivery: 'external' }
  const chosen = ranked[0].stream
  return { index: chosen.index, delivery: resolveDelivery(chosen, burnInPolicy) }
}
