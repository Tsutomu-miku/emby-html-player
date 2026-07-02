import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchHints } from '@/api/library'
import { getImageUrl } from '@/api/images'
import { debounce, cx } from '@/utils'
import type { SearchHint } from '@/api/types'
import { formatDurationShort, ticksToSeconds } from '@/utils/time'
import './SearchSuggest.scss'

/**
 * 搜索建议组件：输入关键词 → debounce 后调用 searchHints → 下拉显示 ≤10 条。
 * 点击跳转 /item/:itemId 并清空。
 */
export function SearchSuggest({ className, userId }: { className?: string; userId: string }) {
  const navigate = useNavigate()
  const [term, setTerm] = useState('')
  const [hints, setHints] = useState<SearchHint[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSearch = useMemo(
    () =>
      debounce((query: string) => {
        void (async () => {
          if (!query.trim() || !userId) {
            setHints([])
            setLoading(false)
            return
          }
          try {
            setLoading(true)
            const res = await searchHints(userId, query, { limit: 10 })
            setHints((res.searchHints || []).slice(0, 10))
          } catch (e) {
            console.error('[searchHints] failed:', e)
            setHints([])
          } finally {
            setLoading(false)
          }
        })()
      }, 300),
    [userId],
  )

  useEffect(() => {
    doSearch(term)
  }, [term, doSearch])

  // 点击外部关闭
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current) return
      if (!wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // 回车：若有第一个结果则跳转
    if (hints.length > 0) {
      const first = hints[0]
      void navigate(`/item/${first.itemId}`)
      setTerm('')
      setOpen(false)
    }
  }

  function handlePick(hint: SearchHint) {
    void navigate(`/item/${hint.itemId}`)
    setTerm('')
    setOpen(false)
  }

  const displayHints = open && term.trim().length > 0

  return (
    <div ref={wrapRef} className={cx('search-suggest', className)}>
      <form onSubmit={handleSubmit} className="search-suggest__form">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="search-suggest__icon"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onFocus={() => {
            if (closeTimer.current) clearTimeout(closeTimer.current)
            setOpen(true)
          }}
          onBlur={() => {
            // 延迟关闭，让点击能先触发
            closeTimer.current = setTimeout(() => setOpen(false), 180)
          }}
          placeholder="搜索影片、剧集、演员…"
          className="search-suggest__input"
        />
        {loading && (
          <div className="search-suggest__spinner" />
        )}
      </form>

      {displayHints && (
        <div className="search-suggest__panel">
          {hints.length === 0 && !loading && (
            <div className="search-suggest__empty">未找到相关结果</div>
          )}
          <ul className="search-suggest__list">
            {hints.map((h) => {
              const thumb =
                h.thumbImageItemId && h.thumbImageTag
                  ? getImageUrl(h.thumbImageItemId, 'Thumb', h.thumbImageTag, {
                      quality: 50,
                      placeholderOnMissing: true,
                    })
                  : h.primaryImageTag
                    ? getImageUrl(h.itemId, 'Primary', h.primaryImageTag, {
                        quality: 50,
                        placeholderOnMissing: true,
                      })
                    : ''
              const subParts: string[] = []
              if (h.type) subParts.push(typeLabel(h.type))
              if (h.productionYear) subParts.push(String(h.productionYear))
              if (h.runTimeTicks) subParts.push(formatDurationShort(ticksToSeconds(h.runTimeTicks)))
              if (h.series) subParts.push(h.series)
              return (
                <li key={h.itemId}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      // 防止 blur 先于 click 触发
                      e.preventDefault()
                      handlePick(h)
                    }}
                    className="search-suggest__item"
                  >
                    <div className="search-suggest__thumb">
                      {thumb ? (
                        <img
                          src={thumb}
                          alt=""
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.onerror = null
                            e.currentTarget.style.visibility = 'hidden'
                          }}
                        />
                      ) : (
                        <div className="search-suggest__thumb-empty">
                          无图
                        </div>
                      )}
                    </div>
                    <div className="search-suggest__item-main">
                      <div className="search-suggest__item-title">{h.name || '未命名'}</div>
                      <div className="search-suggest__item-meta">
                        {subParts.join(' · ')}
                      </div>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

function typeLabel(t: string): string {
  switch (t) {
    case 'Movie':
      return '电影'
    case 'Series':
      return '剧集'
    case 'Season':
      return '季'
    case 'Episode':
      return '剧集'
    case 'Trailer':
      return '预告片'
    case 'MusicVideo':
      return 'MV'
    case 'Video':
      return '视频'
    case 'MusicAlbum':
      return '专辑'
    case 'MusicArtist':
      return '艺术家'
    case 'Audio':
      return '音频'
    case 'Book':
      return '图书'
    case 'Photo':
      return '照片'
    case 'PhotoAlbum':
      return '相册'
    case 'Playlist':
      return '播放列表'
    case 'BoxSet':
      return '合集'
    case 'Folder':
    case 'CollectionFolder':
    case 'AggregateFolder':
      return '文件夹'
    default:
      return t
  }
}
