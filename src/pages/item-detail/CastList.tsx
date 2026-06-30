import type { BaseItemPerson, PersonKind } from '@/api/types'
import { posterUrl } from '@/api/images'

/**
 * 演职员水平滚动列表
 */
export function CastList({
  people,
}: {
  people: (BaseItemPerson & { type?: PersonKind })[]
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-jelly-muted uppercase tracking-wide mb-3">
        演职员
      </h3>
      <div className="flex gap-3 md:gap-4 overflow-x-auto pb-2 -mx-1 px-1">
        {people.slice(0, 18).map((p, i) => (
          <div key={`${p.id || p.name}-${i}`} className="shrink-0 w-20 md:w-24 text-center">
            <div className="aspect-square rounded-lg overflow-hidden bg-jelly-card mb-1.5">
              {p.primaryImageTag && p.id ? (
                <img
                  src={posterUrl(
                    { id: p.id, imageTags: { Primary: p.primaryImageTag } },
                    { quality: 60, placeholderOnMissing: true },
                  )}
                  alt={p.name}
                  loading="lazy"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.onerror = null
                    e.currentTarget.style.visibility = 'hidden'
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-jelly-muted text-lg font-medium">
                  {(p.name || '?').slice(0, 1)}
                </div>
              )}
            </div>
            <div className="text-xs font-medium text-jelly-text truncate" title={p.name}>
              {p.name}
            </div>
            <div className="text-[10px] text-jelly-muted truncate" title={p.role}>
              {p.role || p.type || ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
