import { cx } from '@/utils'

interface ErrorStateProps {
  title?: string
  message?: string
  onRetry?: () => void
  className?: string
}

/**
 * 通用加载失败状态组件。
 */
export function ErrorState({ title, message, onRetry, className }: ErrorStateProps) {
  return (
    <div
      className={cx(
        'flex flex-col items-center justify-center gap-3 p-8 rounded-xl bg-jelly-card',
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-12 h-12 text-red-400"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
      <h3 className="text-lg font-semibold text-jelly-text">{title || '加载失败'}</h3>
      {message && <p className="text-sm text-jelly-muted text-center max-w-md">{message}</p>}
      {onRetry && (
        <button onClick={onRetry} className="btn-ghost mt-2">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4 h-4"
          >
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
            <polyline points="21 3 21 8 16 8" />
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
            <polyline points="3 21 3 16 8 16" />
          </svg>
          重试
        </button>
      )}
    </div>
  )
}
