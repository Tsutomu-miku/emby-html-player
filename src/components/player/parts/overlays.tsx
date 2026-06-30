// Player 的覆盖层组件（Loading / Error）
export function OverlayLoading() {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-[1px]">
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
