import { useSettingsStore } from '@/store/settings'
import {
  SUBTITLE_AUTOSELECT_OPTIONS,
  BURN_IN_OPTIONS,
} from '../constants'
import { FormRow, LangTagList, Range, Select, Switch } from '../controls'

export function SubtitleAudioSection() {
  const set = useSettingsStore((s) => s.set)
  const preferredSubtitleLanguages = useSettingsStore((s) => s.preferredSubtitleLanguages)
  const preferredAudioLanguages = useSettingsStore((s) => s.preferredAudioLanguages)
  const subtitleAutoSelect = useSettingsStore((s) => s.subtitleAutoSelect)
  const burnInPolicy = useSettingsStore((s) => s.burnInPolicy)
  const subtitleFontScale = useSettingsStore((s) => s.subtitleFontScale)
  const subtitleForcedOnly = useSettingsStore((s) => s.subtitleForcedOnly)

  return (
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
            onChange={(v) => set('subtitleAutoSelect', v)}
            options={SUBTITLE_AUTOSELECT_OPTIONS}
          />
        </FormRow>

        <FormRow
          label="字幕烧录策略"
          hint="烧录由 Emby 转码时渲染到画面，会强制走转码；外挂则浏览器直接渲染文本字幕"
        >
          <Select
            value={burnInPolicy}
            onChange={(v) => set('burnInPolicy', v)}
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
  )
}
