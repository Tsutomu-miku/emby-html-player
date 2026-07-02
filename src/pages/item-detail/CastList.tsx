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
    <section className="detail-section cast-strip">
      <header className="detail-section__header">
        <h2>演职员</h2>
      </header>
      <div className="cast-strip__scroller">
        {people.slice(0, 18).map((p, i) => (
          <div key={`${p.id || p.name}-${i}`} className="cast-strip__person">
            <div className="cast-strip__avatar">
              {p.primaryImageTag && p.id ? (
                <img
                  src={posterUrl(
                    { id: p.id, imageTags: { Primary: p.primaryImageTag } },
                    { quality: 60, placeholderOnMissing: true },
                  )}
                  alt={p.name}
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.onerror = null
                    e.currentTarget.style.visibility = 'hidden'
                  }}
                />
              ) : (
                <div className="cast-strip__fallback">
                  {(p.name || '?').slice(0, 1)}
                </div>
              )}
            </div>
            <div className="cast-strip__name" title={p.name}>
              {p.name}
            </div>
            <div className="cast-strip__role" title={p.role}>
              {p.role || p.type || ''}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
