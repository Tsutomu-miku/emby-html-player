import { useSettingsStore } from '@/store/settings'
import { FormRow, NumberInput, Range, Switch } from '../controls'

export function PlaybackExperienceSection() {
  const set = useSettingsStore((s) => s.set)
  const rememberPlaybackRate = useSettingsStore((s) => s.rememberPlaybackRate)
  const defaultPlaybackRate = useSettingsStore((s) => s.defaultPlaybackRate)
  const autoPlayNextEpisode = useSettingsStore((s) => s.autoPlayNextEpisode)
  const showNextEpisodeCountdown = useSettingsStore((s) => s.showNextEpisodeCountdown)
  const nextEpisodeCountdownThreshold = useSettingsStore(
    (s) => s.nextEpisodeCountdownThreshold,
  )
  const nextEpisodeCountdownSeconds = useSettingsStore((s) => s.nextEpisodeCountdownSeconds)
  const resumeRewindSeconds = useSettingsStore((s) => s.resumeRewindSeconds)

  return (
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
  )
}
