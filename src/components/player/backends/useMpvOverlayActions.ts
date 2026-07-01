import { useEffect } from 'react'

interface UseMpvOverlayActionsParams {
  enabled: boolean
  onBack: () => void
  onPrev: () => void
  onNext: () => void
  onMediaSourceChange: (id: string) => void
}

export function useMpvOverlayActions(params: UseMpvOverlayActionsParams): void {
  const { enabled, onBack, onPrev, onNext, onMediaSourceChange } = params
  useEffect(() => window.ehp.onMpvEvent((event) => {
    if (!enabled || event.type !== 'ui-action') return
    switch (event.action) {
      case 'back':
        onBack()
        break
      case 'prev':
        onPrev()
        break
      case 'next':
        onNext()
        break
      case 'media-source':
        if (!event.value) throw new Error('MPV overlay 切源事件缺少 media source id')
        onMediaSourceChange(event.value)
        break
    }
  }), [enabled, onBack, onPrev, onNext, onMediaSourceChange])
}
