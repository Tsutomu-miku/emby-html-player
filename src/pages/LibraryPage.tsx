import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { PosterCard } from '@/components/ui/PosterCard'
import { LibraryFilterBar, DEFAULT_FILTER, type LibraryFilterState } from '@/components/ui/LibraryFilterBar'
import { ErrorState } from '@/components/ui/ErrorState'
import { ViewToggle, type ViewMode } from '@/components/ui/primitives'
import { collectionTypeLabel } from '@/components/layout/Sidebar'
import { useLibraryBrowserModel } from './library/useLibraryBrowserModel'
import { cx } from '@/utils'
import './LibraryPage.scss'

/**
 * 媒体库页面：筛选器 + 无限滚动网格。
 */
export function LibraryPage() {
  const { viewId = '' } = useParams()
  const userId = useAuthStore((s) => s.userId)
  const [filter, setFilter] = useState<LibraryFilterState>(DEFAULT_FILTER)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const model = useLibraryBrowserModel({ userId, viewId, filter })

  const skeletonCount = 24

  function skeletonAspect() {
    // 避免 TS 对字面量类型作过度窄化
    if ((model.posterShape as string) === 'backdrop') return 'library-page__skeleton-poster is-backdrop skeleton'
    return 'library-page__skeleton-poster is-poster skeleton'
  }

  return (
    <div className="library-page">
      <header className="library-page__header">
        <div className="library-page__heading">
          <h1 className="library-page__title">
            {model.viewsState.loading ? (
              <span className="library-page__title-skeleton skeleton" />
            ) : (
              model.currentView?.name || '媒体库'
            )}
          </h1>
          <span className="chip library-page__type-count">
            {model.currentView?.collectionType
              ? collectionTypeLabel(model.currentView.collectionType) + ' · '
              : ''}
            共 {model.total > 0 ? model.total : model.loading ? '…' : model.all.length} 条
          </span>
        </div>
        <ViewToggle
          value={viewMode}
          onChange={setViewMode}
          className="library-page__view-toggle"
        />
      </header>

      <LibraryFilterBar genres={model.genres} value={filter} onChange={setFilter} />

      {model.error && (
        <ErrorState
          title="加载失败"
          message={model.error.message}
          onRetry={() => {
            model.setError(null)
            void model.doLoad()
          }}
        />
      )}

      {model.loading && model.all.length === 0 && !model.error && (
        <div className={cx('library-page__grid', viewMode === 'list' && 'is-list')}>
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <div key={i}>
              <div className={skeletonAspect()} />
              <div className="library-page__skeleton-line skeleton" />
              <div className="library-page__skeleton-line library-page__skeleton-line--short skeleton" />
            </div>
          ))}
        </div>
      )}

      {model.all.length > 0 && (
        <div className={cx('library-page__grid', viewMode === 'list' && 'is-list')}>
          {model.all.map((item) => (
            <PosterCard key={item.id} item={item} shape={model.posterShape} size="md" showPlayButton />
          ))}
        </div>
      )}

      {model.all.length > 0 && model.all.length < model.total && (
        <div ref={model.sentinelRef} className="library-page__load-more">
          {model.loading ? (
            <div className="library-page__loading">
              <span />
              加载中…
            </div>
          ) : (
            <button type="button" className="library-page__load-button" onClick={model.handleLoadMore}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
              加载更多
            </button>
          )}
        </div>
      )}

      {model.all.length > 0 && model.all.length >= model.total && model.total > 0 && (
        <div className="library-page__done">已加载全部内容</div>
      )}

      {!model.loading && model.loadedEmpty && model.total === 0 && !model.error && (
        <div className="library-page__empty">
          <div className="library-page__empty-icon" />
          <div className="library-page__empty-title">该媒体库内还没有内容</div>
          <div className="library-page__empty-text">尝试调整筛选条件或稍后再试</div>
        </div>
      )}
    </div>
  )
}
