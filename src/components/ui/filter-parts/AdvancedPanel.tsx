import { SegmentedControl } from '@/components/ui/primitives'
import type { LibraryFilterState } from '../types'
import './AdvancedPanel.scss'

interface AdvancedPanelProps {
  value: LibraryFilterState
  onChange: (v: LibraryFilterState) => void
  onReset: () => void
  hasActiveFilter: boolean
}

/**
 * 高级筛选面板（漏斗按钮展开的内容）。
 * - 排序方向
 * - 自定义年份范围
 * - 重置按钮（仅当有激活筛选时显示）
 */
export function AdvancedPanel({
  value,
  onChange,
  onReset,
  hasActiveFilter,
}: AdvancedPanelProps) {
  function update<K extends keyof LibraryFilterState>(
    key: K,
    v: LibraryFilterState[K],
  ) {
    onChange({ ...value, [key]: v })
  }

  return (
    <div className="filter-advanced glass-panel animate-menu-in">
      <div className="filter-advanced__group">
        <div className="filter-advanced__title">排序方向</div>
        <SegmentedControl<LibraryFilterState['sortOrder']>
          value={value.sortOrder}
          onChange={(v) => update('sortOrder', v)}
          options={[
            { value: 'Ascending', label: '升序' },
            { value: 'Descending', label: '降序' },
          ]}
        />
      </div>

      <div className="filter-advanced__group">
        <div className="filter-advanced__title">自定义年份范围</div>
        <div className="filter-advanced__range">
          <input
            type="number"
            className="filter-advanced__input"
            placeholder="起始年"
            value={value.yearFrom}
            onChange={(e) => update('yearFrom', e.target.value)}
          />
          <span className="filter-advanced__dash">至</span>
          <input
            type="number"
            className="filter-advanced__input"
            placeholder="结束年"
            value={value.yearTo}
            onChange={(e) => update('yearTo', e.target.value)}
          />
        </div>
      </div>

      {hasActiveFilter ? (
        <button type="button" className="btn-ghost filter-advanced__reset" onClick={onReset}>
          重置全部
        </button>
      ) : null}
    </div>
  )
}
