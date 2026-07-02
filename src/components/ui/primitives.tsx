import type {
  ButtonHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react'
import { cx } from '@/utils'
import './primitives.scss'

export function GlassSurface({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cx('ds-surface', className)}>{children}</div>
}

export function PageSection({
  title,
  action,
  children,
  className,
}: {
  title: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cx('ds-section', className)}>
      <header className="ds-section__header">
        <h2 className="ds-section__title">{title}</h2>
        {action ? <div className="ds-section__action">{action}</div> : null}
      </header>
      {children}
    </section>
  )
}

export function IconButton({
  className,
  children,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={cx('ds-icon-button', className)} {...props}>
      {children}
    </button>
  )
}

export function StatusDot({ className }: { className?: string }) {
  return <span className={cx('ds-status-dot', className)} aria-hidden="true" />
}

/* -------------------------------------------------------------------------- */
/*  FilterPill — compact capsule selector used in library toolbar             */
/* -------------------------------------------------------------------------- */

interface FilterPillProps {
  label: ReactNode
  icon?: ReactNode
  active?: boolean
  caret?: boolean
  badge?: ReactNode
  ariaLabel?: string
  className?: string
  onClick?: () => void
}

export function FilterPill({
  label,
  icon,
  active = false,
  caret = true,
  badge,
  ariaLabel,
  className,
  onClick,
}: FilterPillProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className={cx(
        'ds-filter-pill',
        active && 'is-active',
        className,
      )}
    >
      {icon ? <span className="ds-filter-pill__icon">{icon}</span> : null}
      <span className="ds-filter-pill__label">{label}</span>
      {badge ? (
        <span className="ds-filter-pill__badge" aria-hidden="true">{badge}</span>
      ) : null}
      {caret ? (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="ds-filter-pill__caret"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      ) : null}
    </button>
  )
}

/* -------------------------------------------------------------------------- */
/*  FilterPillSelect — native <select> styled as a filter pill                */
/* -------------------------------------------------------------------------- */

interface FilterPillSelectOption {
  value: string
  label: ReactNode
  disabled?: boolean
}

interface FilterPillSelectProps
  extends Omit<
    SelectHTMLAttributes<HTMLSelectElement>,
    'value' | 'onChange' | 'children'
  > {
  value: string
  onChange: (next: string) => void
  icon?: ReactNode
  label?: ReactNode
  active?: boolean
  options: FilterPillSelectOption[]
  wrapperClassName?: string
}

export function FilterPillSelect({
  value,
  onChange,
  icon,
  label,
  options,
  wrapperClassName,
  className,
  active = false,
  ...rest
}: FilterPillSelectProps) {
  return (
    <label className={cx('ds-filter-pill ds-filter-pill--select', wrapperClassName)}>
      {icon ? <span className="ds-filter-pill__icon">{icon}</span> : null}
      <span className={cx('ds-filter-pill__label', active && 'is-active')}>
        {label ?? options.find((o) => o.value === value)?.label ?? options[0]?.label}
      </span>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="ds-filter-pill__caret"
        aria-hidden="true"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
      <select
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cx('ds-filter-pill__native', className)}
        aria-label={rest['aria-label'] ?? (typeof label === 'string' ? label : undefined)}
      >
        {options.map(({ label: l, value: v, disabled }) => (
          <option key={v} value={v} disabled={disabled}>
            {typeof l === 'string' ? l : String(v)}
          </option>
        ))}
      </select>
    </label>
  )
}

/* -------------------------------------------------------------------------- */
/*  SegmentedControl — pill-style segmented button group                      */
/* -------------------------------------------------------------------------- */

interface SegmentedControlOption<T extends string> {
  value: T
  label: ReactNode
  icon?: ReactNode
}

interface SegmentedControlProps<T extends string> {
  value: T
  onChange: (next: T) => void
  options: SegmentedControlOption<T>[]
  ariaLabel?: string
  className?: string
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cx('ds-segmented', className)}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cx('ds-segmented__item', value === opt.value && 'is-active')}
        >
          {opt.icon ? <span className="ds-segmented__icon">{opt.icon}</span> : null}
          <span>{opt.label}</span>
        </button>
      ))}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  ViewToggle — grid vs list switcher (thin wrapper around SegmentedControl) */
/* -------------------------------------------------------------------------- */

export type ViewMode = 'grid' | 'list'

const GRID_SVG = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
  </svg>
)
const LIST_SVG = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
)

interface ViewToggleProps {
  value: ViewMode
  onChange: (next: ViewMode) => void
  className?: string
}

export function ViewToggle({ value, onChange, className }: ViewToggleProps) {
  return (
    <SegmentedControl<ViewMode>
      value={value}
      onChange={onChange}
      ariaLabel="切换视图"
      className={className}
      options={[
        { value: 'grid', label: '网格', icon: GRID_SVG },
        { value: 'list', label: '列表', icon: LIST_SVG },
      ]}
    />
  )
}
