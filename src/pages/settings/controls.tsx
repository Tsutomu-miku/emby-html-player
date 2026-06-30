import { useState } from 'react'
import { cx } from '@/utils'
import { LANG_PRESETS } from './constants'

export function Select<K extends string>({
  value,
  onChange,
  options,
  disabled,
}: {
  value: K
  onChange: (v: K) => void
  options: Array<{ value: K; label: string }>
  disabled?: boolean
}) {
  return (
    <select
      className={cx('input', disabled && 'opacity-60 cursor-not-allowed')}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as K)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function Switch({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  hint?: string
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none">
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="block w-9 h-5 rounded-full bg-white/10 peer-checked:bg-jelly-accent transition" />
        <span className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white shadow peer-checked:translate-x-4 transition" />
      </span>
      <span className="space-y-0.5 min-w-0">
        <span className="text-sm font-medium text-jelly-text">{label}</span>
        {hint && <div className="text-xs text-jelly-muted">{hint}</div>}
      </span>
    </label>
  )
}

export function FormRow({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-5 items-start">
      <label className="md:col-span-1 pt-1 space-y-0.5">
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-jelly-muted">{hint}</div>}
      </label>
      <div className="md:col-span-2 space-y-1">{children}</div>
    </div>
  )
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
  suffix,
}: {
  value: number
  onChange: (n: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        className="input md:max-w-[240px]"
        value={Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        step={step ?? 1}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (Number.isNaN(n)) return
          let v = n
          if (min !== undefined) v = Math.max(min, v)
          if (max !== undefined) v = Math.min(max, v)
          onChange(v)
        }}
      />
      {suffix && <span className="text-xs text-jelly-muted">{suffix}</span>}
    </div>
  )
}

export function Range({
  value,
  onChange,
  min,
  max,
  step,
  format,
}: {
  value: number
  onChange: (n: number) => void
  min: number
  max: number
  step: number
  format?: (v: number) => string
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        className="w-full accent-jelly-accent"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="text-sm text-jelly-muted tabular-nums shrink-0 w-14 text-right">
        {format ? format(value) : value.toFixed(2)}
      </span>
    </div>
  )
}

export function LangTagList({
  title,
  value,
  onChange,
}: {
  title: string
  value: string[]
  onChange: (next: string[]) => void
}) {
  const [draft, setDraft] = useState('')

  function add(code: string) {
    const c = code.trim().toLowerCase()
    if (!c) return
    if (value.includes(c)) return
    onChange([...value, c])
  }

  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i))
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= value.length) return
    const next = value.slice()
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  function labelOf(code: string) {
    return LANG_PRESETS.find((p) => p.code === code)?.label || code
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {value.length === 0 && (
          <span className="text-xs text-jelly-muted italic py-1 px-1">
            尚未选择任何 {title} 语言。留空时播放器将使用 Emby 默认。
          </span>
        )}
        {value.map((code, i) => (
          <span
            key={`${code}-${i}`}
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/5 border border-white/10 text-xs"
          >
            <span className="text-jelly-muted">{i + 1}.</span>
            <span className="font-mono text-jelly-text">{code}</span>
            <span className="text-jelly-muted">· {labelOf(code)}</span>
            <button
              type="button"
              onClick={() => move(i, -1)}
              disabled={i === 0}
              className="ml-1 px-1 rounded text-jelly-muted hover:text-white hover:bg-white/10 disabled:opacity-30"
              title="优先级上移"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => move(i, 1)}
              disabled={i === value.length - 1}
              className="px-1 rounded text-jelly-muted hover:text-white hover:bg-white/10 disabled:opacity-30"
              title="优先级下移"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => remove(i)}
              className="px-1 rounded text-red-300 hover:bg-red-500/20"
              title="移除"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          className="input md:max-w-[280px]"
          placeholder="输入 ISO 639‑2/3 代码（如 zho / eng / jpn），回车添加"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add(draft)
              setDraft('')
            }
          }}
        />
        <button
          type="button"
          className="btn-ghost !px-3 !py-2 text-xs"
          onClick={() => {
            add(draft)
            setDraft('')
          }}
        >
          添加
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <span className="text-xs text-jelly-muted shrink-0">快捷：</span>
        {LANG_PRESETS.map((p) => {
          const active = value.includes(p.code)
          return (
            <button
              key={p.code}
              type="button"
              onClick={() => (active ? remove(value.indexOf(p.code)) : add(p.code))}
              className={cx(
                'chip transition',
                active
                  ? 'bg-jelly-accent/15 border-jelly-accent/50 text-jelly-accent'
                  : 'hover:bg-white/10 hover:text-white',
              )}
            >
              {p.label}
              <span className="opacity-60 ml-1 font-mono">{p.code}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
