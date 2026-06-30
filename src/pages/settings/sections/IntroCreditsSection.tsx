import { useSettingsStore } from '@/store/settings'
import { FormRow, NumberInput, Switch } from '../controls'

export function IntroCreditsSection() {
  const set = useSettingsStore((s) => s.set)
  const enableIntroSkip = useSettingsStore((s) => s.enableIntroSkip)
  const introSkipStartSeconds = useSettingsStore((s) => s.introSkipStartSeconds)
  const introSkipEndSeconds = useSettingsStore((s) => s.introSkipEndSeconds)
  const introSkipUseKeywordDetect = useSettingsStore((s) => s.introSkipUseKeywordDetect)
  const enableCreditsSkip = useSettingsStore((s) => s.enableCreditsSkip)
  const creditsSkipThresholdSeconds = useSettingsStore((s) => s.creditsSkipThresholdSeconds)

  return (
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
  )
}
