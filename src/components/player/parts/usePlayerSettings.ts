import { useMemo } from 'react'
import { useSettingsStore } from '@/store/settings'

export function usePlayerSettings() {
  const setSettings = useSettingsStore((s) => s.set)
  const rememberPlaybackRate = useSettingsStore((s) => s.rememberPlaybackRate)
  const subtitleFontScale = useSettingsStore((s) => s.subtitleFontScale)
  const enableIntroSkip = useSettingsStore((s) => s.enableIntroSkip)
  const introSkipStartSeconds = useSettingsStore((s) => s.introSkipStartSeconds)
  const introSkipEndSeconds = useSettingsStore((s) => s.introSkipEndSeconds)
  const introSkipUseKeywordDetect = useSettingsStore((s) => s.introSkipUseKeywordDetect)
  const enableCreditsSkip = useSettingsStore((s) => s.enableCreditsSkip)
  const creditsSkipThresholdSeconds = useSettingsStore((s) => s.creditsSkipThresholdSeconds)
  const playMode = useSettingsStore((s) => s.playMode)
  const maxBitrateBps = useSettingsStore((s) => s.maxBitrateBps)
  const maxAudioChannels = useSettingsStore((s) => s.maxAudioChannels)
  const sourceStrategy = useSettingsStore((s) => s.sourceStrategy)
  const preferredAudioLangs = useSettingsStore((s) => s.preferredAudioLanguages)
  const preferredSubLangs = useSettingsStore((s) => s.preferredSubtitleLanguages)
  const subtitleAutoSelect = useSettingsStore((s) => s.subtitleAutoSelect)
  const burnInPolicy = useSettingsStore((s) => s.burnInPolicy)
  const subtitleForcedOnly = useSettingsStore((s) => s.subtitleForcedOnly)
  const resumeRewindSeconds = useSettingsStore((s) => s.resumeRewindSeconds)
  const readSettings = useMemo(() => ({
    playMode, maxBitrateBps, maxAudioChannels, sourceStrategy,
    preferredAudioLangs, preferredSubLangs,
    subtitleAutoSelect, burnInPolicy, subtitleForcedOnly, resumeRewindSeconds,
  }), [
    playMode, maxBitrateBps, maxAudioChannels, sourceStrategy,
    preferredAudioLangs, preferredSubLangs,
    subtitleAutoSelect, burnInPolicy, subtitleForcedOnly, resumeRewindSeconds,
  ])
  return {
    setSettings,
    rememberPlaybackRate,
    subtitleFontScale,
    enableIntroSkip,
    introSkipStartSeconds,
    introSkipEndSeconds,
    introSkipUseKeywordDetect,
    enableCreditsSkip,
    creditsSkipThresholdSeconds,
    readSettings,
  }
}
