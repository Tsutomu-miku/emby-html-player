import { useState } from 'react'
import { useAuthStore } from '@/store/auth'
import { useSettingsStore } from '@/store/settings'
import { updateUserConfiguration } from '@/api/userConfig'
import { PlaySection } from './settings/sections/PlaySection'
import { SubtitleAudioSection } from './settings/sections/SubtitleAudioSection'
import { IntroCreditsSection } from './settings/sections/IntroCreditsSection'
import { PlaybackExperienceSection } from './settings/sections/PlaybackExperienceSection'
import { LocalSection } from './settings/sections/LocalSection'
import { FooterSection } from './settings/sections/FooterSection'

export function SettingsPage() {
  const [toast, setToast] = useState<string>('')
  const [syncing, setSyncing] = useState(false)

  const reset = useSettingsStore((s) => s.reset)
  const buildRemotePatch = useSettingsStore((s) => s.buildRemotePatch)

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
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-white">设置</h1>
        <p className="text-sm text-jelly-muted">
          默认情况下所有设置只保存在<strong>本浏览器 localStorage</strong>（key：
          <code className="mx-1 px-1 py-0.5 bg-white/5 rounded font-mono text-xs">ehp_settings</code>
          ），不会写入 Emby 服务器的用户配置。如需多端共享，请使用页面底部的「同步到 Emby 服务器」按钮。
        </p>
      </div>

      <PlaySection />
      <SubtitleAudioSection />
      <IntroCreditsSection />
      <PlaybackExperienceSection />
      <LocalSection />

      <FooterSection
        onReset={handleReset}
        onSync={handleSyncRemote}
        syncing={syncing}
        toast={toast}
      />
    </div>
  )
}
