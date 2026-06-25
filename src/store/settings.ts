import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SubtitleMode, IntroSkipMode } from '@/api/types'

// --- 常量枚举（让 UI 与 Player 子任务共享） ---
export const BITRATE_PRESETS: Array<{ label: string; bps: number }> = [
  { label: '自动（20 Mbps）', bps: 20_000_000 },
  { label: '4 Mbps · 720p', bps: 4_000_000 },
  { label: '8 Mbps · 1080p', bps: 8_000_000 },
  { label: '12 Mbps · 1080p 高码率', bps: 12_000_000 },
  { label: '20 Mbps · 4K SDR', bps: 20_000_000 },
  { label: '40 Mbps · 4K HDR', bps: 40_000_000 },
  { label: '不限制（200 Mbps）', bps: 200_000_000 },
]
export const AUDIO_CHANNEL_PRESETS = [2, 6, 8] as const

export type PlayMode =
  | 'auto' // 三模式全开
  | 'direct-play' // 仅 DirectPlay（关闭 DirectStream & Transcode）
  | 'direct-stream' // DirectPlay + DirectStream
  | 'transcode' // 仅转码（关闭直链）

export type SourceSelectionStrategy =
  | 'quality' // 画质优先：bitrate 降序
  | 'size' // 体积优先：bitrate 升序
  | 'balanced' // 平衡：默认实现的打分策略

export type BurnInSubtitlePolicy =
  | 'auto' // 位图自动烧录，文本外挂
  | 'bitmap-only' // 仅位图烧录，文本一律外挂
  | 'always' // 所有字幕一律烧录（忽略外挂）
  | 'never' // 所有字幕一律尝试外挂；位图字幕则关闭显示

export type SubtitleAutoSelectPolicy =
  | 'off' // 默认关闭字幕
  | 'smart' // 智能：与界面语言不同的语言 + SDH/CC
  | 'foreign' // 仅外语（与首选语言不同）
  | 'sdh' // 仅 SDH/CC 字幕
  | 'always' // 总是打开默认字幕

export type ThemeMode = 'system' | 'light' | 'dark'

export interface LocalSettings {
  // ===== 播放：播放方式 & 码率 =====
  playMode: PlayMode
  maxBitrateBps: number
  maxAudioChannels: number
  sourceStrategy: SourceSelectionStrategy

  // ===== 字幕 =====
  preferredSubtitleLanguages: string[] // 按优先级排列的 ISO 639-1 代码，如 ['zho', 'eng', 'jpn']。允许用户输入并追加到数组
  preferredAudioLanguages: string[] // 同上，音轨语言
  subtitleAutoSelect: SubtitleAutoSelectPolicy // 自动选字幕的条件
  burnInPolicy: BurnInSubtitlePolicy
  subtitleFontScale: number // 外挂字幕字体缩放（0.7 - 2.0），默认 1.0
  subtitleForcedOnly: boolean // 只选强制字幕

  // ===== 跳过片头片尾 =====
  enableIntroSkip: boolean
  introSkipStartSeconds: number // 默认 0
  introSkipEndSeconds: number // 默认 90
  enableCreditsSkip: boolean
  creditsSkipThresholdSeconds: number // 默认最后 60s（仅自动）
  introSkipUseKeywordDetect: boolean // 是否根据章节名包含「片头曲/片尾曲/PV/ED/OP」等自动跳（仅设置开关，具体关键字逻辑在 Player 里）

  // ===== 播放体验 =====
  rememberPlaybackRate: boolean // 记忆用户选定的倍速
  defaultPlaybackRate: number // 下次进入播放器时使用的倍速（remember=true 时持久化）
  autoPlayNextEpisode: boolean // 播放结束自动跳下一集
  showNextEpisodeCountdown: boolean // 显示倒计时卡片
  nextEpisodeCountdownThreshold: number // 距离结束多少秒触发（默认 40）
  nextEpisodeCountdownSeconds: number // 倒计时长度（默认 10）
  resumeRewindSeconds: number // 续播回退 N 秒（默认 5）

  // ===== 本地偏好 =====
  theme: ThemeMode
  enableStaticResourceCache: boolean // SW 静态资源缓存（只是存值，SW 注册由后续功能启用，预留）
  includeAdultContent: boolean // 含成人内容（默认关，Emby 的 ParentalRating 过滤）
  postersAspectPreset: 'poster' | 'backdrop' | 'square' | 'auto' // 卡片图默认比例
}

/** 字段 → Emby UserConfiguration 的映射（用于显式同步到服务器） */
export type RemoteSyncablePatch = {
  subtitleLanguagePreference?: string
  audioLanguagePreference?: string
  playDefaultAudioTrack?: boolean
  displayMissingEpisodes?: boolean
  subtitleMode?: SubtitleMode
  hidePlayedInLatest?: boolean
  rememberAudioSelections?: boolean
  rememberSubtitleSelections?: boolean
  enableNextEpisodeAutoPlay?: boolean
  resumeRewindSeconds?: number
  introSkipMode?: IntroSkipMode
}

interface SettingsState extends LocalSettings {
  /** 单字段更新（UI onChange 用） */
  set: <K extends keyof LocalSettings>(key: K, value: LocalSettings[K]) => void
  /** 批量更新 */
  patch: (patch: Partial<LocalSettings>) => void
  /** 重置默认 */
  reset: () => void
  /**
   * 把 settings 中可映射的字段组装成 Emby UserConfiguration patch。
   * 注意：这里只构造对象供调用方使用，本函数**不发起网络请求**，以遵守「默认不写入用户偏好」。
   */
  buildRemotePatch: () => RemoteSyncablePatch
}

export const DEFAULT_SETTINGS: LocalSettings = {
  // 播放方式 & 码率
  playMode: 'auto',
  maxBitrateBps: 20_000_000,
  maxAudioChannels: 6,
  sourceStrategy: 'balanced',

  // 字幕 / 音轨
  preferredSubtitleLanguages: ['zho', 'eng'],
  preferredAudioLanguages: ['zho', 'eng'],
  subtitleAutoSelect: 'smart',
  burnInPolicy: 'auto',
  subtitleFontScale: 1.0,
  subtitleForcedOnly: false,

  // 片头片尾
  enableIntroSkip: false,
  introSkipStartSeconds: 0,
  introSkipEndSeconds: 90,
  enableCreditsSkip: false,
  creditsSkipThresholdSeconds: 60,
  introSkipUseKeywordDetect: false,

  // 播放体验
  rememberPlaybackRate: true,
  defaultPlaybackRate: 1.0,
  autoPlayNextEpisode: true,
  showNextEpisodeCountdown: true,
  nextEpisodeCountdownThreshold: 40,
  nextEpisodeCountdownSeconds: 10,
  resumeRewindSeconds: 5,

  // 本地偏好
  theme: 'dark',
  enableStaticResourceCache: false,
  includeAdultContent: false,
  postersAspectPreset: 'auto',
}

/**
 * 把 settings 转为能写回 Emby UserConfiguration 的 patch。
 * 规则：
 *  - 字幕语言：preferredSubtitleLanguages[0]（若有）→ subtitleLanguagePreference
 *  - 音频语言：preferredAudioLanguages[0]（若有）→ audioLanguagePreference
 *  - enableNextEpisodeAutoPlay / resumeRewindSeconds 直接映射
 *  - subtitleMode / introSkipMode：按 settings 派生
 *  - rememberSubtitleSelections / rememberAudioSelections：由 rememberPlaybackRate、subtitleForcedOnly 等启发
 * 用户在 UI 显式点击「同步到服务器」时调用 buildRemotePatch()，然后 updateUserConfiguration(userId, patch)。
 */
function toRemotePatch(s: LocalSettings): RemoteSyncablePatch {
  const patch: RemoteSyncablePatch = {}
  if (s.preferredSubtitleLanguages[0])
    patch.subtitleLanguagePreference = s.preferredSubtitleLanguages[0]
  if (s.preferredAudioLanguages[0])
    patch.audioLanguagePreference = s.preferredAudioLanguages[0]
  patch.enableNextEpisodeAutoPlay = s.autoPlayNextEpisode
  patch.resumeRewindSeconds = s.resumeRewindSeconds
  patch.rememberAudioSelections = s.rememberPlaybackRate
  patch.rememberSubtitleSelections = s.rememberPlaybackRate
  switch (s.subtitleAutoSelect) {
    case 'always':
      patch.subtitleMode = 'Always'
      break
    case 'foreign':
      patch.subtitleMode = 'OnlyForeign'
      break
    case 'sdh':
    case 'smart':
      patch.subtitleMode = 'Smart'
      break
    case 'off':
      patch.subtitleMode = 'None'
      break
    default:
      patch.subtitleMode = 'Default'
  }
  patch.introSkipMode = s.enableIntroSkip
    ? s.introSkipUseKeywordDetect
      ? 'Auto'
      : 'ShowButton'
    : 'None'
  patch.playDefaultAudioTrack = true
  patch.displayMissingEpisodes = true
  patch.hidePlayedInLatest = !s.includeAdultContent
  return patch
}

// 从 SettingsState 中排除函数键后得到的持久化形状
type PersistedSettings = Omit<
  SettingsState,
  'set' | 'patch' | 'reset' | 'buildRemotePatch'
>

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_SETTINGS,

      set: (key, value) => set((s) => ({ ...s, [key]: value })),
      patch: (p) => set((s) => ({ ...s, ...p })),
      reset: () => set({ ...DEFAULT_SETTINGS }),

      buildRemotePatch: () => toRemotePatch(get()),
    }),
    {
      name: 'ehp_settings',
      // 使用解构排除函数字段，TypeScript 自动推断出正确的持久化形状，
      // 比 Object.fromEntries 过滤 + as 类型断言更严格、更安全。
      partialize: (state): PersistedSettings => {
        const {
          set: _s,
          patch: _p,
          reset: _r,
          buildRemotePatch: _b,
          ...rest
        } = state
        return rest
      },
    },
  ),
)

/** 小工具：根据 preferredLanguages 列表和字幕流 language 字段，返回匹配优先级索引
 * （0 = 完全匹配，越大越不匹配；-1 不匹配） */
export function rankLanguageMatch(preferred: string[], actual?: string): number {
  if (!actual) return preferred.length // 无语言：次于全部匹配
  const a = actual.toLowerCase()
  for (let i = 0; i < preferred.length; i++) {
    const p = preferred[i].toLowerCase()
    if (p === a) return i
    // 兼容前缀：如 zho / zho-Hans / chi 都视为中文
    if (a.startsWith(p) || p.startsWith(a)) return i + 0.5
  }
  return -1
}
