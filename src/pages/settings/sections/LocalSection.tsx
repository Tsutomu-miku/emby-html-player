import { useSettingsStore } from '@/store/settings'
import { THEME_OPTIONS, POSTER_ASPECT_OPTIONS } from '../constants'
import { FormRow, Select, Switch } from '../controls'

export function LocalSection() {
  const set = useSettingsStore((s) => s.set)
  const patch = useSettingsStore((s) => s.patch)
  const theme = useSettingsStore((s) => s.theme)
  const enableStaticResourceCache = useSettingsStore((s) => s.enableStaticResourceCache)
  const includeAdultContent = useSettingsStore((s) => s.includeAdultContent)
  const postersAspectPreset = useSettingsStore((s) => s.postersAspectPreset)

  return (
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
            onChange={(v) => set('theme', v)}
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
            onChange={(v) => patch({ postersAspectPreset: v })}
            options={POSTER_ASPECT_OPTIONS}
          />
        </FormRow>
      </div>
    </section>
  )
}
