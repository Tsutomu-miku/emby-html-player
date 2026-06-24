import type { BaseItemDto } from '@/api/types'
import { cx } from '@/utils'

export interface SeasonPickerProps {
  seasons: BaseItemDto[]
  activeId?: string
  onChange: (seasonId: string) => void
}

/**
 * 季选择器：以 chip / tab 形式展示，激活样式有高亮 + accent 下划线。
 */
export function SeasonPicker({ seasons, activeId, onChange }: SeasonPickerProps) {
  if (!seasons || seasons.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {seasons.map((s) => {
        const index = s.parentIndexNumber
        const title =
          s.name && s.name !== `Season ${index}`
            ? s.name
            : index
              ? `S${String(index).padStart(2, '0')}${s.name && s.name !== `Season ${index}` ? ` · ${s.name}` : ''}`
              : '未命名季'
        const isActive = s.id === activeId
        return (
          <button
            key={s.id}
            onClick={() => onChange(s.id)}
            className={cx(
              'relative px-3 py-1.5 rounded-md text-sm transition-colors',
              isActive
                ? 'bg-jelly-accent/20 text-jelly-accent font-medium'
                : 'bg-jelly-card text-jelly-muted hover:text-jelly-text hover:bg-jelly-hover',
            )}
          >
            {title}
            {isActive && (
              <span className="absolute left-2 right-2 -bottom-px h-[2px] bg-jelly-accent rounded-full" />
            )}
          </button>
        )
      })}
    </div>
  )
}
