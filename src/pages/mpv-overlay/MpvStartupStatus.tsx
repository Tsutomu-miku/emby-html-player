interface MpvStartupStatusProps {
  currentTime: number
  elapsedSeconds: number
  fileLoaded: boolean
  speed: number
}

export function MpvStartupStatus(props: MpvStartupStatusProps) {
  const { currentTime, elapsedSeconds, fileLoaded, speed } = props
  const speedText = formatSpeed(speed)
  const phase = resolveStartupPhase({ elapsedSeconds, fileLoaded, speed })
  return (
    <div className="mpv-overlay__startup-status" role="status" aria-label="播放缓冲状态">
      <span className="mpv-overlay__startup-dot" />
      <div className="mpv-overlay__startup-main">
        <span className="mpv-overlay__startup-title">{phase}</span>
        <span className="mpv-overlay__startup-subtitle">
          等待 {formatElapsed(elapsedSeconds)}
          {' · '}
          {speedText ? `接收 ${speedText}` : '暂无下载速率'}
          {currentTime > 0 ? ` · 已定位 ${formatClock(currentTime)}` : ''}
        </span>
      </div>
    </div>
  )
}

function resolveStartupPhase(input: {
  elapsedSeconds: number
  fileLoaded: boolean
  speed: number
}): string {
  if (input.fileLoaded) return '媒体已载入，等待首帧渲染'
  if (input.speed > 0) return '正在接收媒体数据'
  if (input.elapsedSeconds >= 8) return '仍在等待媒体响应'
  return '正在建立媒体连接'
}

function formatSpeed(bytesPerSecond: number) {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return ''
  if (bytesPerSecond >= 1024 * 1024) return `${(bytesPerSecond / 1024 / 1024).toFixed(1)} MB/s`
  if (bytesPerSecond >= 1024) return `${Math.round(bytesPerSecond / 1024)} KB/s`
  return `${Math.round(bytesPerSecond)} B/s`
}

function formatElapsed(seconds: number): string {
  if (seconds < 10) return `${seconds.toFixed(1)}s`
  return `${Math.round(seconds)}s`
}

function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  return `${minutes}:${String(secs).padStart(2, '0')}`
}
