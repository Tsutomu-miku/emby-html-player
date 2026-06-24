import { useState, useEffect, useMemo } from 'react'
import { useAuthStore } from '@/store/auth'
import { getGenres } from '@/api/library'
import { debounce, cx } from '@/utils'

export interface LibraryFilterState {
  sortBy: string
  sortOrder: 'Ascending' | 'Descending'
  genre: string
  yearFrom: string
  yearTo: string
  played: 'all' | 'played' | 'unplayed'
  searchTerm: string
}

export const DEFAULT_FILTER: LibraryFilterState = {
  sortBy: 'SortName',
  sortOrder: 'Ascending',
  genre: '',
  yearFrom: '',
  yearTo: '',
  played: 'all',
  searchTerm: '',
}

interface LibraryFilterBarProps {
  viewId: string
  value: LibraryFilterState
  onChange: (v: LibraryFilterState) => void
}

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'SortName', label: '名称' },
  { value: 'ProductionYear', label: '制作年份' },
  { value: 'PremiereDate', label: '首映日期' },
  { value: 'DateCreated', label: '添加时间' },
  { value: 'CommunityRating', label: '社区评分' },
  { value: 'Random', label: '随机' },
]

const YEAR_PRESETS: { label: string; from: number | ''; to: number | '' }[] = [
  { label: '全部', from: '', to: '' },
  { label: '最近 5 年', from: new Date().getFullYear() - 5, to: '' },
  { label: '最近 10 年', from: new Date().getFullYear() - 10, to: '' },
  { label: '2010s', from: 2010, to: 2019 },
  { label: '2000s', from: 2000, to: 2009 },
  { label: '经典 (前 2000)', from: '', to: 1999 },
]

/**
 * 媒体库筛选条：排序、类型、年份、已看状态、关键词搜索。
 */
export function LibraryFilterBar({ viewId, value, onChange }: LibraryFilterBarProps) {
  const userId = useAuthStore((s) => s.userId)
  const [genres, setGenres] = useState<{ name: string }[]>([])

  // 加载 Genres
  useEffect(() => {
    let cancelled = false
    if (!userId || !viewId) return
    getGenres(userId, { parentId: viewId, limit: 100, recursive: true })
      .then((r) => {
        if (cancelled) return
        setGenres(r.items?.map((it) => ({ name: it.name || '' })).filter((g) => g.name) || [])
      })
      .catch((e) => console.error('[getGenres] failed:', e))
    return () => {
      cancelled = true
    }
  }, [userId, viewId])

  const [searchLocal, setSearchLocal] = useState(value.searchTerm)

  // 外部变更同步回本地
  useEffect(() => {
    setSearchLocal(value.searchTerm)
  }, [value.searchTerm])

  // debounced search term
  const debouncedSearch = useMemo(
    () =>
      debounce((v: string) => {
        onChange({ ...value, searchTerm: v })
      }, 200),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [value.sortBy, value.sortOrder, value.genre, value.yearFrom, value.yearTo, value.played],
  )

  function update<K extends keyof LibraryFilterState>(key: K, v: LibraryFilterState[K]) {
    onChange({ ...value, [key]: v })
  }

  function applyYearPreset(from: number | '', to: number | '') {
    onChange({
      ...value,
      yearFrom: from === '' ? '' : String(from),
      yearTo: to === '' ? '' : String(to),
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* 搜索 */}
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-jelly-muted pointer-events-none"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={searchLocal}
              onChange={(e) => {
                setSearchLocal(e.target.value)
                debouncedSearch(e.target.value)
              }}
              placeholder="搜索该媒体库…"
              className="input bg-jelly-panel pl-9"
            />
          </div>
        </div>

        {/* 排序方式 */}
        <label className="flex items-center gap-2">
          <span className="text-sm text-jelly-muted shrink-0">排序</span>
          <select
            value={value.sortBy}
            onChange={(e) => update('sortBy', e.target.value)}
            className="input bg-jelly-panel !py-1.5 w-auto text-sm min-w-[110px]"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            value={value.sortOrder}
            onChange={(e) => update('sortOrder', e.target.value as 'Ascending' | 'Descending')}
            className="input bg-jelly-panel !py-1.5 w-auto text-sm"
          >
            <option value="Ascending">升序</option>
            <option value="Descending">降序</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* 类型 */}
        <label className="flex items-center gap-2">
          <span className="text-sm text-jelly-muted shrink-0">类型</span>
          <select
            value={value.genre}
            onChange={(e) => update('genre', e.target.value)}
            className="input bg-jelly-panel !py-1.5 w-auto text-sm min-w-[140px] max-w-[220px]"
          >
            <option value="">全部</option>
            {genres.map((g) => (
              <option key={g.name} value={g.name}>
                {g.name}
              </option>
            ))}
          </select>
        </label>

        {/* 年份预设 */}
        <label className="flex items-center gap-2">
          <span className="text-sm text-jelly-muted shrink-0">年代</span>
          <select
            value={
              YEAR_PRESETS.find(
                (p) => String(p.from) === value.yearFrom && String(p.to) === value.yearTo,
              )
                ? `${value.yearFrom}-${value.yearTo}`
                : '__custom__'
            }
            onChange={(e) => {
              if (e.target.value === '__custom__') return
              const [f, t] = e.target.value.split('-')
              applyYearPreset(f === '' ? '' : Number(f), t === '' ? '' : Number(t))
            }}
            className="input bg-jelly-panel !py-1.5 w-auto text-sm"
          >
            {YEAR_PRESETS.map((p) => (
              <option key={`${p.from}-${p.to}`} value={`${p.from}-${p.to}`}>
                {p.label}
              </option>
            ))}
            <option value="__custom__" disabled>
              自定义
            </option>
          </select>
        </label>

        {/* 已看筛选 */}
        <div className="inline-flex rounded-md overflow-hidden border border-white/10">
          {(
            [
              { key: 'all', label: '全部' },
              { key: 'played', label: '已看' },
              { key: 'unplayed', label: '未看' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => update('played', opt.key)}
              className={cx(
                'px-3 py-1.5 text-sm transition-colors',
                value.played === opt.key
                  ? 'bg-jelly-accent text-white'
                  : 'bg-jelly-panel text-jelly-muted hover:text-jelly-text hover:bg-jelly-hover',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* 重置 */}
        <button
          type="button"
          onClick={() => onChange(DEFAULT_FILTER)}
          className="btn-ghost !py-1.5 text-xs ml-auto"
        >
          重置
        </button>
      </div>
    </div>
  )
}
