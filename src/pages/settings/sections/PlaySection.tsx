import { useMemo } from 'react'
import {
  useSettingsStore,
  BITRATE_PRESETS,
  AUDIO_CHANNEL_PRESETS,
} from '@/store/settings'
import {
  PLAY_MODE_OPTIONS,
  SOURCE_STRATEGY_OPTIONS,
} from '../constants'
import { FormRow, Select } from '../controls'

export function PlaySection() {
  const set = useSettingsStore((s) => s.set)
  const playMode = useSettingsStore((s) => s.playMode)
  const maxBitrateBps = useSettingsStore((s) => s.maxBitrateBps)
  const maxAudioChannels = useSettingsStore((s) => s.maxAudioChannels)
  const sourceStrategy = useSettingsStore((s) => s.sourceStrategy)

  const directModeActive = useMemo(
    () => playMode === 'direct-play' || playMode === 'direct-stream',
    [playMode],
  )

  return (
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
            onChange={(v) => set('playMode', v)}
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
                c === 2 ? '2.0 立体声' : c === 6 ? '5.1 环绕' : c === 8 ? '7.1 环绕' : `${Number(c)}.0`,
            }))}
          />
        </FormRow>

        <FormRow label="媒体源选择策略" hint="同一片源有多版本（4K/1080p…）时的默认取舍">
          <Select
            value={sourceStrategy}
            onChange={(v) => set('sourceStrategy', v)}
            options={SOURCE_STRATEGY_OPTIONS}
          />
        </FormRow>
      </div>
    </section>
  )
}
