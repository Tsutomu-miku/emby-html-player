import { useMemo, useState } from 'react'
import { useAuthStore } from '@/store/auth'
import {
  useSettingsStore,
  BITRATE_PRESETS,
  AUDIO_CHANNEL_PRESETS,
  type PlayMode,
  type SourceSelectionStrategy,
  type BurnInSubtitlePolicy,
  type SubtitleAutoSelectPolicy,
  type ThemeMode,
} from '@/store/settings'
import { updateUserConfiguration } from '@/api/userConfig'
import { cx } from '@/utils'

/* ====================== 常量 ====================== */

const LANG_PRESETS: Array<{ code: string; label: string }> = [
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

const PLAY_MODE_OPTIONS: Array<{ value: PlayMode; label: string }> = [
  { value: 'auto', label: '自动（推荐：直链优先，失败回落转码）' },
  { value: 'direct-play', label: '仅 DirectPlay（兼容性最高，不转码）' },
  { value: 'direct-stream', label: '直链 + 容器改写（关闭转码）' },
  { value: 'transcode', label: '总是转码（由服务器承担重活）' },
]

const SOURCE_STRATEGY_OPTIONS: Array<{
  value: SourceSelectionStrategy
  label: string
}> = [
  { value: 'quality', label: '画质优先（高码率）' },
  { value: 'balanced', label: '平衡（推荐）' },
  { value: 'size', label: '体积优先（低码率，省流量）' },
]

const SUBTITLE_AUTOSELECT_OPTIONS: Array<{
  value: SubtitleAutoSelectPolicy
  label: string
}> = [
  { value: 'always', label: '总是开启默认字幕' },
  { value: 'smart', label: '智能（外语或 SDH 时开）' },
  { value: 'foreign', label: '仅外语' },
  { value: 'sdh', label: '仅 SDH/听障字幕' },
  { value: 'off', label: '默认关闭' },
]

const BURN_IN_OPTIONS: Array<{ value: BurnInSubtitlePolicy; label: string }> = [
  { value: 'auto', label: '自动：位图烧录，文本外挂' },
  { value: 'bitmap-only', label: '仅位图字幕烧录' },
  { value: 'always', label: '全部烧录（兼容性最好）' },
  { value: 'never', label: '永不烧录（位图字幕将不显示）' },
]

const THEME_OPTIONS: Array<{ value: ThemeMode; label: string }> = [
  { value: 'system', label: '跟随系统' },
  { value: 'light', label: '亮色' },
  { value: 'dark', label: '暗色' },
]

const POSTER_ASPECT_OPTIONS: Array<{
  value: 'auto' | 'poster' | 'backdrop' | 'square'
  label: string
}> = [
  { value: 'auto', label: '按媒体类型自适应' },
  { value: 'poster', label: '海报 2:3' },
  { value: 'backdrop', label: '封面 16:9' },
  { value: 'square', label: '方形 1:1' },
]

/* ====================== 小组件 ====================== */

function Select<K extends string>({
  value,
  onChange,
  options,
  disabled,
}: {
  value: K
  onChange: (v: K) => void
  options: Array<{ value: K; label: string }>
  disabled?: boolean
}) {
  return (
    <select
      className={cx('input', disabled && 'opacity-60 cursor-not-allowed')}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as K)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

function Switch({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  hint?: string
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none">
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="block w-9 h-5 rounded-full bg-white/10 peer-checked:bg-jelly-accent transition" />
        <span className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white shadow peer-checked:translate-x-4 transition" />
      </span>
      <span className="space-y-0.5 min-w-0">
        <span className="text-sm font-medium text-jelly-text">{label}</span>
        {hint && <div className="text-xs text-jelly-muted">{hint}</div>}
      </span>
    </label>
  )
}

function FormRow({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-5 items-start">
      <label className="md:col-span-1 pt-1 space-y-0.5">
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-jelly-muted">{hint}</div>}
      </label>
      <div className="md:col-span-2 space-y-1">{children}</div>
    </div>
  )
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
  suffix,
}: {
  value: number
  onChange: (n: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        className="input md:max-w-[240px]"
        value={Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        step={step ?? 1}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (Number.isNaN(n)) return
          let v = n
          if (min !== undefined) v = Math.max(min, v)
          if (max !== undefined) v = Math.min(max, v)
          onChange(v)
        }}
      />
      {suffix && <span className="text-xs text-jelly-muted">{suffix}</span>}
    </div>
  )
}

function Range({
  value,
  onChange,
  min,
  max,
  step,
  format,
}: {
  value: number
  onChange: (n: number) => void
  min: number
  max: number
  step: number
  format?: (v: number) => string
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        className="w-full accent-jelly-accent"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="text-sm text-jelly-muted tabular-nums shrink-0 w-14 text-right">
        {format ? format(value) : value.toFixed(2)}
      </span>
    </div>
  )
}

/* ====================== 语言 tag 列表 ====================== */

function LangTagList({
  title,
  value,
  onChange,
}: {
  title: string
  value: string[]
  onChange: (next: string[]) => void
}) {
  const [draft, setDraft] = useState('')

  function add(code: string) {
    const c = code.trim().toLowerCase()
    if (!c) return
    if (value.includes(c)) return
    onChange([...value, c])
  }

  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i))
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= value.length) return
    const next = value.slice()
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  function labelOf(code: string) {
    return LANG_PRESETS.find((p) => p.code === code)?.label || code
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {value.length === 0 && (
          <span className="text-xs text-jelly-muted italic py-1 px-1">
            尚未选择任何 {title} 语言。留空时播放器将使用 Emby 默认。
          </span>
        )}
        {value.map((code, i) => (
          <span
            key={`${code}-${i}`}
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/5 border border-white/10 text-xs"
          >
            <span className="text-jelly-muted">{i + 1}.</span>
            <span className="font-mono text-jelly-text">{code}</span>
            <span className="text-jelly-muted">· {labelOf(code)}</span>
            <button
              type="button"
              onClick={() => move(i, -1)}
              disabled={i === 0}
              className="ml-1 px-1 rounded text-jelly-muted hover:text-white hover:bg-white/10 disabled:opacity-30"
              title="优先级上移"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => move(i, 1)}
              disabled={i === value.length - 1}
              className="px-1 rounded text-jelly-muted hover:text-white hover:bg-white/10 disabled:opacity-30"
              title="优先级下移"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => remove(i)}
              className="px-1 rounded text-red-300 hover:bg-red-500/20"
              title="移除"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          className="input md:max-w-[280px]"
          placeholder="输入 ISO 639‑2/3 代码（如 zho / eng / jpn），回车添加"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add(draft)
              setDraft('')
            }
          }}
        />
        <button
          type="button"
          className="btn-ghost !px-3 !py-2 text-xs"
          onClick={() => {
            add(draft)
            setDraft('')
          }}
        >
          添加
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <span className="text-xs text-jelly-muted shrink-0">快捷：</span>
        {LANG_PRESETS.map((p) => {
          const active = value.includes(p.code)
          return (
            <button
              key={p.code}
              type="button"
              onClick={() => (active ? remove(value.indexOf(p.code)) : add(p.code))}
              className={cx(
                'chip transition',
                active
                  ? 'bg-jelly-accent/15 border-jelly-accent/50 text-jelly-accent'
                  : 'hover:bg-white/10 hover:text-white',
              )}
            >
              {p.label}
              <span className="opacity-60 ml-1 font-mono">{p.code}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ====================== 主组件 ====================== */

export function SettingsPage() {
  const [toast, setToast] = useState<string>('')
  const [syncing, setSyncing] = useState(false)

  const set = useSettingsStore((s) => s.set)
  const patch = useSettingsStore((s) => s.patch)
  const reset = useSettingsStore((s) => s.reset)
  const buildRemotePatch = useSettingsStore((s) => s.buildRemotePatch)

  // 每个字段单独 selector，避免整页重渲染
  const playMode = useSettingsStore((s) => s.playMode)
  const maxBitrateBps = useSettingsStore((s) => s.maxBitrateBps)
  const maxAudioChannels = useSettingsStore((s) => s.maxAudioChannels)
  const sourceStrategy = useSettingsStore((s) => s.sourceStrategy)

  const preferredSubtitleLanguages = useSettingsStore((s) => s.preferredSubtitleLanguages)
  const preferredAudioLanguages = useSettingsStore((s) => s.preferredAudioLanguages)
  const subtitleAutoSelect = useSettingsStore((s) => s.subtitleAutoSelect)
  const burnInPolicy = useSettingsStore((s) => s.burnInPolicy)
  const subtitleFontScale = useSettingsStore((s) => s.subtitleFontScale)
  const subtitleForcedOnly = useSettingsStore((s) => s.subtitleForcedOnly)

  const enableIntroSkip = useSettingsStore((s) => s.enableIntroSkip)
  const introSkipStartSeconds = useSettingsStore((s) => s.introSkipStartSeconds)
  const introSkipEndSeconds = useSettingsStore((s) => s.introSkipEndSeconds)
  const introSkipUseKeywordDetect = useSettingsStore((s) => s.introSkipUseKeywordDetect)
  const enableCreditsSkip = useSettingsStore((s) => s.enableCreditsSkip)
  const creditsSkipThresholdSeconds = useSettingsStore((s) => s.creditsSkipThresholdSeconds)

  const rememberPlaybackRate = useSettingsStore((s) => s.rememberPlaybackRate)
  const defaultPlaybackRate = useSettingsStore((s) => s.defaultPlaybackRate)
  const autoPlayNextEpisode = useSettingsStore((s) => s.autoPlayNextEpisode)
  const showNextEpisodeCountdown = useSettingsStore((s) => s.showNextEpisodeCountdown)
  const nextEpisodeCountdownThreshold = useSettingsStore((s) => s.nextEpisodeCountdownThreshold)
  const nextEpisodeCountdownSeconds = useSettingsStore((s) => s.nextEpisodeCountdownSeconds)
  const resumeRewindSeconds = useSettingsStore((s) => s.resumeRewindSeconds)

  const theme = useSettingsStore((s) => s.theme)
  const enableStaticResourceCache = useSettingsStore((s) => s.enableStaticResourceCache)
  const includeAdultContent = useSettingsStore((s) => s.includeAdultContent)
  const postersAspectPreset = useSettingsStore((s) => s.postersAspectPreset)

  const directModeActive = useMemo(
    () => playMode === 'direct-play' || playMode === 'direct-stream',
    [playMode],
  )

  function showToast(msg: string) {
    setToast(msg)
    window.setTimeout(() => setToast(''), 2500)
  }

  async function handleSyncRemote() {
    if (
      !window.confirm(
        '确认把当前设置中可映射的字段写入 Emby 服务器用户配置吗？\n\n会影响同一账号在其它客户端的偏好（字幕语言、自动跳下一集、片头跳过模式等）。',
      )
    )
      return
    const userId = useAuthStore.getState().userId
    if (!userId) {
      showToast('请先登录')
      return
    }
    const patchObj = buildRemotePatch()
    try {
      setSyncing(true)
      await updateUserConfiguration(userId, patchObj)
      showToast('✅ 已同步到服务器')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      showToast(`❌ 同步失败：${msg}`)
    } finally {
      setSyncing(false)
    }
  }

  function handleReset() {
    if (!window.confirm('恢复全部默认设置？当前所有自定义选项会丢失。')) return
    reset()
    showToast('已恢复默认设置')
  }

  return (
    <div className="px-4 md:px-8 py-6 max-w-[1100px] mx-auto space-y-6">
      {/* 标题 */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-white">设置</h1>
        <p className="text-sm text-jelly-muted">
          默认情况下所有设置只保存在<strong>本浏览器 localStorage</strong>（key：
          <code className="mx-1 px-1 py-0.5 bg-white/5 rounded font-mono text-xs">ehp_settings</code>
          ），不会写入 Emby 服务器的用户配置。如需多端共享，请使用页面底部的「同步到 Emby 服务器」按钮。
        </p>
      </div>

      {/* A. 播放 */}
      <section className="card p-5 md:p-6 space-y-4">
        <header>
          <h2 className="text-lg font-semibold">播放</h2>
          <p className="text-sm text-jelly-muted">
            播放方式、默认码率、选源策略等。「仅直链」模式下若浏览器无法原生解码则会播放失败。
          </p>
        </header>
        <div className="space-y-4">
          <FormRow label="默认播放方式" hint="决定播放器是否允许直链/转码">
            <Select
              value={playMode}
              onChange={(v) => set('playMode', v as PlayMode)}
              options={PLAY_MODE_OPTIONS}
            />
          </FormRow>

          <FormRow
            label="默认转码码率上限"
            hint={
              directModeActive
                ? '直链模式不限制码率，此处仅对转码生效'
                : '仅对转码/DirectStream 生效；直链使用原片码率'
            }
          >
            <Select
              value={String(maxBitrateBps)}
              onChange={(v) => set('maxBitrateBps', Number(v))}
              options={BITRATE_PRESETS.map((p) => ({
                value: String(p.bps),
                label: p.label,
              }))}
              disabled={directModeActive}
            />
          </FormRow>

          <FormRow label="最大音频声道" hint="超过此时 Emby 将混音为允许的最大声道数">
            <Select
              value={String(maxAudioChannels)}
              onChange={(v) => set('maxAudioChannels', Number(v))}
              options={AUDIO_CHANNEL_PRESETS.map((c) => ({
                value: String(c),
                label:
                  c === 2 ? '2.0 立体声' : c === 6 ? '5.1 环绕' : c === 8 ? '7.1 环绕' : `${c}.0`,
              }))}
            />
          </FormRow>

          <FormRow label="媒体源选择策略" hint="同一片源有多版本（4K/1080p…）时的默认取舍">
            <Select
              value={sourceStrategy}
              onChange={(v) => set('sourceStrategy', v as SourceSelectionStrategy)}
              options={SOURCE_STRATEGY_OPTIONS}
            />
          </FormRow>
        </div>
      </section>

      {/* B. 字幕 & 音轨 */}
      <section className="card p-5 md:p-6 space-y-4">
        <header>
          <h2 className="text-lg font-semibold">字幕 &amp; 音轨</h2>
          <p className="text-sm text-jelly-muted">
            播放器将按首选语言优先级自动挑选音轨和字幕；排序越靠前优先级越高。
          </p>
        </header>
        <div className="space-y-4">
          <FormRow label="首选字幕语言（按优先级）">
            <LangTagList
              title="字幕"
              value={preferredSubtitleLanguages}
              onChange={(v) => set('preferredSubtitleLanguages', v)}
            />
          </FormRow>

          <FormRow label="首选音轨语言（按优先级）">
            <LangTagList
              title="音轨"
              value={preferredAudioLanguages}
              onChange={(v) => set('preferredAudioLanguages', v)}
            />
          </FormRow>

          <FormRow label="字幕自动选择条件" hint="默认开启字幕的时机">
            <Select
              value={subtitleAutoSelect}
              onChange={(v) => set('subtitleAutoSelect', v as SubtitleAutoSelectPolicy)}
              options={SUBTITLE_AUTOSELECT_OPTIONS}
            />
          </FormRow>

          <FormRow
            label="字幕烧录策略"
            hint="烧录由 Emby 转码时渲染到画面，会强制走转码；外挂则浏览器直接渲染文本字幕"
          >
            <Select
              value={burnInPolicy}
              onChange={(v) => set('burnInPolicy', v as BurnInSubtitlePolicy)}
              options={BURN_IN_OPTIONS}
            />
          </FormRow>

          <FormRow label="只启用强制字幕" hint="仅当音轨为外语且存在「Forced」字幕时开启">
            <Switch
              checked={subtitleForcedOnly}
              onChange={(v) => set('subtitleForcedOnly', v)}
              label="仅启用 Forced 字幕（仅对白翻译，不包含画面内文字）"
            />
          </FormRow>

          <FormRow
            label="外挂字幕字体缩放"
            hint="仅对浏览器外挂加载的文本字幕（SRT/VTT/ASS）生效；烧录字幕由 Emby 控制"
          >
            <Range
              value={subtitleFontScale}
              onChange={(v) => set('subtitleFontScale', v)}
              min={0.7}
              max={2.0}
              step={0.1}
              format={(v) => `${v.toFixed(1)}×`}
            />
          </FormRow>
        </div>
      </section>

      {/* C. 跳过片头片尾 */}
      <section className="card p-5 md:p-6 space-y-4">
        <header>
          <h2 className="text-lg font-semibold">跳过片头片尾</h2>
          <p className="text-sm text-jelly-muted">
            支持固定秒数区间、或基于 Emby 章节名关键字（OP / ED / 片头曲 / 片尾曲 / PV）识别。
          </p>
        </header>
        <div className="space-y-4">
          <FormRow
            label="启用跳过片头"
            hint="开启后，进入 [片头起始秒, 片头结束秒] 区间时按策略处理"
          >
            <div className="space-y-3">
              <Switch
                checked={enableIntroSkip}
                onChange={(v) => set('enableIntroSkip', v)}
                label="启用自动跳过片头"
                hint={
                  introSkipUseKeywordDetect
                    ? '当前按 Emby 章节关键字匹配，自动跳到片尾（Auto 模式）'
                    : '当前按固定时间区间，在进入区间时显示「跳过片头」按钮'
                }
              />
              {enableIntroSkip && (
                <div className="pl-1 space-y-3 border-l-2 border-white/10 ml-1">
                  <FormRow label="片头起始秒" hint="固定 OP 区间的起点（默认 0）">
                    <NumberInput
                      value={introSkipStartSeconds}
                      onChange={(v) => set('introSkipStartSeconds', v)}
                      min={0}
                      suffix="秒"
                    />
                  </FormRow>
                  <FormRow label="片头结束秒" hint="固定 OP 区间的终点（默认 90）">
                    <NumberInput
                      value={introSkipEndSeconds}
                      onChange={(v) => set('introSkipEndSeconds', v)}
                      min={0}
                      suffix="秒"
                    />
                  </FormRow>
                  <Switch
                    checked={introSkipUseKeywordDetect}
                    onChange={(v) => set('introSkipUseKeywordDetect', v)}
                    label="基于章节关键字自动识别并自动跳过（Auto 模式）"
                    hint="关闭时使用上面的固定区间并显示「跳过片头」按钮；打开时自动跳过且不弹按钮"
                  />
                </div>
              )}
            </div>
          </FormRow>

          <FormRow label="启用跳过片尾" hint="播放进入最后 N 秒时，若有下一集则自动跳过去">
            <div className="space-y-3">
              <Switch
                checked={enableCreditsSkip}
                onChange={(v) => set('enableCreditsSkip', v)}
                label="启用片尾跳过（仅在有下一集时生效）"
              />
              {enableCreditsSkip && (
                <div className="pl-1 border-l-2 border-white/10 ml-1">
                  <FormRow label="片尾时长（秒）" hint="距离末尾多少秒算作片尾（默认 60）">
                    <NumberInput
                      value={creditsSkipThresholdSeconds}
                      onChange={(v) => set('creditsSkipThresholdSeconds', v)}
                      min={0}
                      suffix="秒"
                    />
                  </FormRow>
                </div>
              )}
            </div>
          </FormRow>
        </div>
      </section>

      {/* D. 播放体验 */}
      <section className="card p-5 md:p-6 space-y-4">
        <header>
          <h2 className="text-lg font-semibold">播放体验</h2>
          <p className="text-sm text-jelly-muted">倍速、下一集自动跳转、续播回退等主观偏好。</p>
        </header>
        <div className="space-y-4">
          <FormRow
            label="倍速记忆"
            hint="打开后播放器会记住你上次使用的倍速；关闭则每次使用下方「默认倍速」"
          >
            <div className="space-y-3">
              <Switch
                checked={rememberPlaybackRate}
                onChange={(v) => set('rememberPlaybackRate', v)}
                label="记住用户选定的播放倍速"
              />
              <div className="pl-1 border-l-2 border-white/10 ml-1">
                <FormRow label="默认倍速" hint="未记忆 / 记忆关闭时使用">
                  <Range
                    value={defaultPlaybackRate}
                    onChange={(v) => set('defaultPlaybackRate', v)}
                    min={0.5}
                    max={2.0}
                    step={0.25}
                    format={(v) => `${v.toFixed(2)}×`}
                  />
                </FormRow>
              </div>
            </div>
          </FormRow>

          <FormRow
            label="自动跳下一集"
            hint="一集播放结束后，自动加载并播放下一集（仅剧集）"
          >
            <Switch
              checked={autoPlayNextEpisode}
              onChange={(v) => set('autoPlayNextEpisode', v)}
              label="播放结束自动跳下一集"
            />
          </FormRow>

          <FormRow
            label="显示下一集倒计时卡片"
            hint="播放接近末尾时弹出「下一集 · 10 秒倒计时」浮层"
          >
            <div className="space-y-3">
              <Switch
                checked={showNextEpisodeCountdown}
                onChange={(v) => set('showNextEpisodeCountdown', v)}
                label="显示倒计时浮层"
              />
              {showNextEpisodeCountdown && (
                <div className="pl-1 space-y-3 border-l-2 border-white/10 ml-1">
                  <FormRow label="距离结束多少秒显示" hint="默认 40">
                    <NumberInput
                      value={nextEpisodeCountdownThreshold}
                      onChange={(v) => set('nextEpisodeCountdownThreshold', v)}
                      min={1}
                      max={3600}
                      suffix="秒"
                    />
                  </FormRow>
                  <FormRow label="倒计时秒数" hint="默认 10 秒后自动播放下一集">
                    <NumberInput
                      value={nextEpisodeCountdownSeconds}
                      onChange={(v) => set('nextEpisodeCountdownSeconds', v)}
                      min={3}
                      max={60}
                      suffix="秒"
                    />
                  </FormRow>
                </div>
              )}
            </div>
          </FormRow>

          <FormRow
            label="续播回退 N 秒"
            hint="每次从上次断点续播时，会再往前回退 N 秒，避免错过前情（默认 5）"
          >
            <NumberInput
              value={resumeRewindSeconds}
              onChange={(v) => set('resumeRewindSeconds', v)}
              min={0}
              max={600}
              suffix="秒"
            />
          </FormRow>
        </div>
      </section>

      {/* E. 本地 */}
      <section className="card p-5 md:p-6 space-y-4">
        <header>
          <h2 className="text-lg font-semibold">本地（仅本浏览器）</h2>
          <p className="text-sm text-jelly-muted">
            与界面外观、性能相关的偏好；这些不会同步到 Emby 服务器。
          </p>
        </header>
        <div className="space-y-4">
          <FormRow
            label="主题"
            hint="亮色主题 CSS 后续版本补齐，当前仅影响设置值"
          >
            <Select
              value={theme}
              onChange={(v) => set('theme', v as ThemeMode)}
              options={THEME_OPTIONS}
            />
          </FormRow>

          <FormRow
            label="Service Worker 静态资源缓存"
            hint="仅保存开关；SW 注册逻辑将在后续版本启用"
          >
            <Switch
              checked={enableStaticResourceCache}
              onChange={(v) => set('enableStaticResourceCache', v)}
              label="启用 Service Worker 静态资源缓存（下次生效）"
            />
          </FormRow>

          <FormRow
            label="包含成人内容"
            hint="仅在 Emby 账号已授权时生效，不会绕过服务器的家长监护"
          >
            <Switch
              checked={includeAdultContent}
              onChange={(v) => set('includeAdultContent', v)}
              label="在搜索、推荐、继续观看中包含成人内容"
            />
          </FormRow>

          <FormRow label="媒体卡片默认比例" hint="首页 / 媒体库卡片纵横比默认值">
            <Select
              value={postersAspectPreset}
              onChange={(v) =>
                patch({ postersAspectPreset: v as LocalSettings['postersAspectPreset'] })
              }
              options={POSTER_ASPECT_OPTIONS}
            />
          </FormRow>
        </div>
      </section>

      {/* 底部：重置 + 同步 */}
      <section className="card p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center gap-4 justify-between border-l-4 border-l-jelly-accent">
        <div className="space-y-1">
          <div className="font-semibold">操作</div>
          <div className="text-sm text-jelly-muted leading-relaxed">
            ⚠️「同步到 Emby 服务器」会<strong>写入该账号的用户配置</strong>
            （字幕语言、自动跳下一集、片头跳过模式、续播回退秒数等），仅在你希望<strong>多端共享</strong>这些设置时使用。
            <br />
            默认情况下所有设置仅存储在本浏览器 localStorage（
            <code className="mx-1 px-1 py-0.5 bg-white/5 rounded font-mono text-xs">ehp_settings</code>
            ）。
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-ghost" onClick={handleReset}>
            恢复默认设置
          </button>
          <button
            type="button"
            className="btn"
            onClick={handleSyncRemote}
            disabled={syncing}
          >
            {syncing ? '同步中…' : '🔗 同步到 Emby 服务器（当前用户）'}
          </button>
        </div>
      </section>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2 rounded-md bg-jelly-card border border-white/10 text-jelly-text shadow-2xl text-sm animate-in fade-in slide-in-from-bottom-2">
          {toast}
        </div>
      )}
    </div>
  )
}

/* 给 posterAspectPreset 的 Select onChange 提供类型锚点，顺便给 tsc 作 shape 检查 */
import type { LocalSettings } from '@/store/settings'
