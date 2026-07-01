import { backdropUrl, posterUrl } from '@/api/images'

interface OverlayMediaItem {
  id?: string
  name?: string
  imageTags?: Record<string, string>
  backdropImageTags?: string[]
  parentBackdropImageTags?: string[]
  parentBackdropItemId?: string
}

// Player 的覆盖层组件（Loading / Error）
export function OverlayLoading({ item }: { item?: OverlayMediaItem | null }) {
  const backdropSrc = item ? backdropUrl(item, { quality: 70 }) : ''
  const posterSrc = item ? posterUrl(item, { quality: 70 }) : ''

  return (
    <div className="absolute inset-0 z-40 overflow-hidden bg-[#05080c]">
      {backdropSrc ? (
        <img
          src={backdropSrc}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-35 blur-sm scale-105"
        />
      ) : null}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.12),transparent_20rem),linear-gradient(90deg,rgba(5,8,12,0.94),rgba(5,8,12,0.56)_45%,rgba(5,8,12,0.82))]" />
      <div className="relative z-10 flex h-full items-center px-8 sm:px-12">
        {posterSrc ? (
          <img
            src={posterSrc}
            alt=""
            className="hidden h-44 w-32 rounded-lg object-cover shadow-2xl ring-1 ring-white/15 sm:block"
          />
        ) : null}
        <div className="ml-0 grid max-w-xl gap-4 text-white sm:ml-8">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-jelly-accent">
              正在准备播放
            </div>
            <h2 className="mt-2 line-clamp-2 text-2xl font-extrabold leading-tight sm:text-4xl">
              {item?.name || '媒体内容'}
            </h2>
          </div>
          <div className="flex items-center gap-3 text-sm text-white/70">
            <div
              className="h-8 w-8 rounded-full border-2 border-white/20 border-t-jelly-accent animate-spin"
              aria-label="加载中"
            />
            <span>正在建立播放会话并初始化 MPV 内嵌渲染…</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function OverlayInlineLoading() {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/35 backdrop-blur-[1px]">
      <div className="flex flex-col items-center gap-4 text-white/80">
        <div
          className="w-10 h-10 rounded-full border-2 border-white/20 border-t-jelly-accent animate-spin"
          aria-label="加载中"
        />
        <div className="text-sm">准备播放…</div>
      </div>
    </div>
  )
}

export function OverlayError(props: {
  message: string
  hasOther: boolean
  onRetry: () => void
  onNext: () => void
}) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-6">
      <div className="max-w-md w-full rounded-xl bg-jelly-card/90 ring-1 ring-white/10 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-500/15 text-red-300 flex items-center justify-center text-xl">
            !
          </div>
          <div>
            <div className="text-white font-semibold text-base">播放失败</div>
            <div className="text-white/60 text-xs mt-0.5 break-all">{props.message}</div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={props.onRetry} className="btn flex-1 min-w-[7rem]">
            重试
          </button>
          {props.hasOther ? (
            <button
              type="button"
              onClick={props.onNext}
              className="btn-ghost flex-1 min-w-[10rem]"
            >
              切换到下一个源
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
