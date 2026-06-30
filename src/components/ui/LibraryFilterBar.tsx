import { useState, useEffect, useMemo } from 'react'
import { useAuthStore } from '@/store/auth'
import { getGenres } from '@/api/library'
import { debounce, cx } from '@/utils'
import './LibraryFilterBar.scss'

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
    <div className="filter-bar">
      <div className="filter-bar__row filter-bar__row--primary">
        <div className="filter-bar__search">
          <div className="filter-bar__search-wrap">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="filter-bar__search-icon"
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
              className="filter-bar__input filter-bar__input--search"
            />
          </div>
        </div>

        <label className="filter-bar__field">
          <span className="filter-bar__label">排序</span>
          <select
            value={value.sortBy}
            onChange={(e) => update('sortBy', e.target.value)}
            className="filter-bar__select"
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
            className="filter-bar__select filter-bar__select--small"
          >
            <option value="Ascending">升序</option>
            <option value="Descending">降序</option>
          </select>
        </label>
      </div>

      <div className="filter-bar__row">
        <label className="filter-bar__field">
          <span className="filter-bar__label">类型</span>
          <select
            value={value.genre}
            onChange={(e) => update('genre', e.target.value)}
            className="filter-bar__select filter-bar__select--wide"
          >
            <option value="">全部</option>
            {genres.map((g) => (
              <option key={g.name} value={g.name}>
                {g.name}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-bar__field">
          <span className="filter-bar__label">年代</span>
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
            className="filter-bar__select"
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

        <div className="filter-bar__segments">
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
                'filter-bar__segment',
                value.played === opt.key && 'is-active',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => onChange(DEFAULT_FILTER)}
          className="filter-bar__reset"
        >
          重置
        </button>
      </div>
    </div>
  )
}
