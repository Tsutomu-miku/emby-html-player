import type { ButtonHTMLAttributes, ReactNode } from 'react'
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
