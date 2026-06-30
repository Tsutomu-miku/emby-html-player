import type {
  PlayMode,
  SourceSelectionStrategy,
  BurnInSubtitlePolicy,
  SubtitleAutoSelectPolicy,
  ThemeMode,
} from '@/store/settings'

export const LANG_PRESETS: Array<{ code: string; label: string }> = [
  { code: 'zho', label: '中文' },
  { code: 'eng', label: '英语' },
  { code: 'jpn', label: '日语' },
  { code: 'kor', label: '韩语' },
  { code: 'fra', label: '法语' },
  { code: 'spa', label: '西班牙语' },
  { code: 'deu', label: '德语' },
  { code: 'rus', label: '俄语' },
  { code: 'ind', label: '印尼语' },
]

export const PLAY_MODE_OPTIONS: Array<{ value: PlayMode; label: string }> = [
  { value: 'auto', label: '自动（推荐：优先 DirectStream，必要时转码）' },
  { value: 'direct-play', label: '仅 DirectPlay（不转码，依赖 CDN 放行）' },
  { value: 'direct-stream', label: '仅 DirectStream（容器改写，不转码）' },
  { value: 'transcode', label: '总是转码（由服务器承担重活）' },
]

export const SOURCE_STRATEGY_OPTIONS: Array<{
  value: SourceSelectionStrategy
  label: string
}> = [
  { value: 'quality', label: '画质优先（高码率）' },
  { value: 'balanced', label: '平衡（推荐）' },
  { value: 'size', label: '体积优先（低码率，省流量）' },
]

export const SUBTITLE_AUTOSELECT_OPTIONS: Array<{
  value: SubtitleAutoSelectPolicy
  label: string
}> = [
  { value: 'always', label: '总是开启默认字幕' },
  { value: 'smart', label: '智能（外语或 SDH 时开）' },
  { value: 'foreign', label: '仅外语' },
  { value: 'sdh', label: '仅 SDH/听障字幕' },
  { value: 'off', label: '默认关闭' },
]

export const BURN_IN_OPTIONS: Array<{ value: BurnInSubtitlePolicy; label: string }> = [
  { value: 'auto', label: '自动：位图烧录，文本外挂' },
  { value: 'bitmap-only', label: '仅位图字幕烧录' },
  { value: 'always', label: '全部烧录（兼容性最好）' },
  { value: 'never', label: '永不烧录（位图字幕将不显示）' },
]

export const THEME_OPTIONS: Array<{ value: ThemeMode; label: string }> = [
  { value: 'system', label: '跟随系统' },
  { value: 'light', label: '亮色' },
  { value: 'dark', label: '暗色' },
]

export const POSTER_ASPECT_OPTIONS: Array<{
  value: 'auto' | 'poster' | 'backdrop' | 'square'
  label: string
}> = [
  { value: 'auto', label: '按媒体类型自适应' },
  { value: 'poster', label: '海报 2:3' },
  { value: 'backdrop', label: '封面 16:9' },
  { value: 'square', label: '方形 1:1' },
]
