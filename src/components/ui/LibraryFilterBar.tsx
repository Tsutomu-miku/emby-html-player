import { useState, useEffect, useMemo, useRef } from 'react'
import { debounce, cx } from '@/utils'
import {
  FilterPill,
  FilterPillSelect,
  SegmentedControl,
} from '@/components/ui/primitives'
import {
  SORT_ICON,
  TYPE_ICON,
  YEAR_ICON,
  FUNNEL_ICON,
  SEARCH_ICON,
  ASC_ICON,
} from './filter-parts/icons'
import { AdvancedPanel } from './filter-parts/AdvancedPanel'
import type { LibraryFilterState } from './types'
import { DEFAULT_FILTER } from './types'
import './LibraryFilterBar.scss'

export type { LibraryFilterState } from './types'
export { DEFAULT_FILTER } from './types'

export interface LibraryFilterBarProps {
  genres: { name: string }[]
  value: LibraryFilterState
  onChange: (v: LibraryFilterState) => void
}

const SORT_OPTIONS = [
  { value: 'SortName', label: '名称' },
  { value: 'ProductionYear', label: '制作年份' },
  { value: 'PremiereDate', label: '首映日期' },
  { value: 'DateCreated', label: '添加时间' },
  { value: 'CommunityRating', label: '社区评分' },
  { value: 'Random', label: '随机' },
] as const

const YEAR_PRESETS = [
  { label: '全部年代', from: '' as const, to: '' as const },
  { label: '最近 5 年', from: new Date().getFullYear() - 5, to: '' as const },
  { label: '最近 10 年', from: new Date().getFullYear() - 10, to: '' as const },
  { label: '2010s', from: 2010, to: 2019 },
  { label: '2000s', from: 2000, to: 2009 },
  { label: '经典 (2000前)', from: '' as const, to: 1999 },
] as const

type YearPresetKey = string

function yearKey(from: string, to: string): YearPresetKey {
  return `${from}-${to}`
}

const PLAYED_OPTIONS: {
  value: LibraryFilterState['played']
  label: string
}[] = [
  { value: 'all', label: '全部' },
  { value: 'played', label: '已看' },
  { value: 'unplayed', label: '未看' },
]

const isDefault = (f: LibraryFilterState): boolean =>
  f.sortBy === DEFAULT_FILTER.sortBy &&
  f.sortOrder === DEFAULT_FILTER.sortOrder &&
  f.genre === DEFAULT_FILTER.genre &&
  f.yearFrom === DEFAULT_FILTER.yearFrom &&
  f.yearTo === DEFAULT_FILTER.yearTo &&
  f.played === DEFAULT_FILTER.played &&
  f.searchTerm === DEFAULT_FILTER.searchTerm

export function LibraryFilterBar({ genres, value, onChange }: LibraryFilterBarProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!advancedOpen) return
    function onClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setAdvancedOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [advancedOpen])

  const [searchLocal, setSearchLocal] = useState(value.searchTerm)
  useEffect(() => setSearchLocal(value.searchTerm), [value.searchTerm])

  const debouncedSearch = useMemo(
    () =>
      debounce((v: string) => {
        onChange({ ...value, searchTerm: v })
      }, 220),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      value.sortBy,
      value.sortOrder,
      value.genre,
      value.yearFrom,
      value.yearTo,
      value.played,
    ],
  )

  function update<K extends keyof LibraryFilterState>(
    key: K,
    v: LibraryFilterState[K],
  ) {
    onChange({ ...value, [key]: v })
  }

  const yearPresetKey: YearPresetKey =
    YEAR_PRESETS.find(
      (p) => String(p.from) === value.yearFrom && String(p.to) === value.yearTo,
    )
      ? yearKey(value.yearFrom, value.yearTo)
      : '__custom__'

  function applyYearPreset(key: YearPresetKey) {
    if (key === '__custom__') return
    const [from, to] = key.split('-')
    onChange({ ...value, yearFrom: from, yearTo: to })
  }

  const sortLabel =
    SORT_OPTIONS.find((o) => o.value === value.sortBy)?.label ?? '排序'

  const hasActiveFilter = !isDefault(value)
  const funnelActive =
    value.sortOrder !== DEFAULT_FILTER.sortOrder || hasActiveFilter

  function activeFilterCount(): number {
    let n = 0
    if (value.sortBy !== DEFAULT_FILTER.sortBy) n++
    if (value.sortOrder !== DEFAULT_FILTER.sortOrder) n++
    if (value.genre !== DEFAULT_FILTER.genre) n++
    if (value.yearFrom !== DEFAULT_FILTER.yearFrom) n++
    if (value.yearTo !== DEFAULT_FILTER.yearTo) n++
    if (value.played !== DEFAULT_FILTER.played) n++
    if (value.searchTerm !== DEFAULT_FILTER.searchTerm) n++
    return n
  }

  const funnelBadge = hasActiveFilter ? String(activeFilterCount()) : undefined

  return (
    <div className="filter-bar">
      <div className="filter-bar__row">
        <div className="filter-bar__group">
          <FilterPillSelect
            icon={SORT_ICON}
            label={sortLabel}
            value={value.sortBy}
            onChange={(v) => update('sortBy', v)}
            aria-label="排序方式"
            active={value.sortBy !== DEFAULT_FILTER.sortBy}
            options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />
          <button
            type="button"
            aria-label="排序方向"
            className={cx(
              'filter-bar__sort-order',
              value.sortOrder === 'Descending' && 'is-desc',
            )}
            onClick={() =>
              update(
                'sortOrder',
                value.sortOrder === 'Ascending' ? 'Descending' : 'Ascending',
              )
            }
            title={value.sortOrder === 'Ascending' ? '升序' : '降序'}
          >
            {ASC_ICON}
          </button>
        </div>

        <FilterPillSelect
          icon={TYPE_ICON}
          label={value.genre ? value.genre : '类型'}
          value={value.genre}
          onChange={(v) => update('genre', v)}
          aria-label="类型"
          active={Boolean(value.genre)}
          options={[
            { value: '', label: '全部类型' },
            ...genres.map((g) => ({ value: g.name, label: g.name })),
          ]}
        />

        <FilterPillSelect
          icon={YEAR_ICON}
          label={
            YEAR_PRESETS.find(
              (p) =>
                String(p.from) === value.yearFrom && String(p.to) === value.yearTo,
            )?.label ?? '自定义'
          }
          value={yearPresetKey}
          onChange={applyYearPreset}
          aria-label="年代"
          active={
            value.yearFrom !== DEFAULT_FILTER.yearFrom ||
            value.yearTo !== DEFAULT_FILTER.yearTo
          }
          options={YEAR_PRESETS.map((p) => ({
            value: yearKey(String(p.from), String(p.to)),
            label: p.label,
          }))}
        />

        <SegmentedControl<LibraryFilterState['played']>
          value={value.played}
          onChange={(v) => update('played', v)}
          ariaLabel="观看状态"
          options={PLAYED_OPTIONS}
        />

        <div className="filter-bar__advanced" ref={panelRef}>
          <FilterPill
            label="筛选"
            icon={FUNNEL_ICON}
            active={funnelActive || advancedOpen}
            caret={!advancedOpen}
            badge={funnelBadge}
            ariaLabel="更多筛选"
            onClick={() => setAdvancedOpen((v) => !v)}
          />
          {advancedOpen ? (
            <AdvancedPanel
              value={value}
              onChange={onChange}
              onReset={() => onChange(DEFAULT_FILTER)}
              hasActiveFilter={hasActiveFilter}
            />
          ) : null}
        </div>

        <div className="filter-bar__spacer" />

        <div className="filter-bar__search">
          <span className="filter-bar__search-icon" aria-hidden="true">
            {SEARCH_ICON}
          </span>
          <input
            type="text"
            value={searchLocal}
            onChange={(e) => {
              setSearchLocal(e.target.value)
              debouncedSearch(e.target.value)
            }}
            placeholder="搜索该媒体库…"
            className="filter-bar__input filter-bar__input--search"
          />
        </div>
      </div>
    </div>
  )
}
