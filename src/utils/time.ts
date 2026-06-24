/** Ticks <-> 秒/分/小时 转换。Emby 用 C# 风格的 100ns ticks。 */
const TICKS_PER_SECOND = 10_000_000n

export function ticksToSeconds(ticks: number | bigint | null | undefined): number {
  if (ticks === null || ticks === undefined) return 0
  const t = typeof ticks === 'bigint' ? ticks : BigInt(Math.round(ticks))
  return Number(t / TICKS_PER_SECOND)
}

export function secondsToTicks(seconds: number): number {
  return Math.round(seconds) * 10_000_000
}

export function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return '0:00'
  const s = Math.floor(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
  return `${m}:${String(ss).padStart(2, '0')}`
}

export function formatDurationShort(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return '0m'
  const s = Math.floor(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

/** 将 ISO 字符串格式化为 YYYY-MM-DD */
export function formatDate(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * 将 ISO 日期字符串格式化为相对时间（如 "3 天前"）。
 */
export function formatRelative(iso?: string): string {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ''
  const diff = Date.now() - t
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec} 秒前`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} 分钟前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} 小时前`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day} 天前`
  const mo = Math.floor(day / 30)
  if (mo < 12) return `${mo} 个月前`
  const yr = Math.floor(day / 365)
  return `${yr} 年前`
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
