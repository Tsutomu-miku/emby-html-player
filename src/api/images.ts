import { useAuthStore } from '@/store/auth'
import { buildQuery } from './http'

export type ImageType =
  | 'Primary'
  | 'Art'
  | 'Backdrop'
  | 'Banner'
  | 'Logo'
  | 'Thumb'
  | 'Disc'
  | 'Box'
  | 'Screenshot'
  | 'Menu'
  | 'Chapter'
  | 'BoxRear'
  | 'Profile'

export interface ImageUrlOptions {
  width?: number
  height?: number
  maxWidth?: number
  maxHeight?: number
  fillWidth?: number
  fillHeight?: number
  quality?: number // 0-100
  tag?: string
  /** 当有多张同类型图时的索引（例如 backdrop 有多个） */
  imageIndex?: number
  /** 若为 true，返回占位图 URL（data URI） */
  placeholderOnMissing?: boolean
}

/**
 * 构建图片 URL。
 *
 * 说明：
 * - imageTag 可以来自 item.imageTags[type]，或 backdropImageTags[i]，或 primaryImageTag 等。
 * - 若传 itemId（非空），则返回该条目对应图片；否则返回 parentId 指定的条目图片。
 */
export function getImageUrl(
  itemId: string | undefined,
  type: ImageType,
  tag: string | undefined,
  opts: ImageUrlOptions = {},
): string {
  const { server, accessToken, deviceId } = useAuthStore.getState()
  if (!itemId || !tag) {
    if (opts.placeholderOnMissing) return placeholder(type, opts)
    return ''
  }
  const base = (server || '').replace(/\/+$/, '')
  if (!base) {
    if (opts.placeholderOnMissing) return placeholder(type, opts)
    return ''
  }
  const params: Record<string, string | number | boolean | undefined> = {
    api_key: accessToken,
    DeviceId: deviceId,
  }
  if (tag) params.Tag = tag
  if (opts.width) params.Width = opts.width
  if (opts.height) params.Height = opts.height
  if (opts.maxWidth) params.MaxWidth = opts.maxWidth
  if (opts.maxHeight) params.MaxHeight = opts.maxHeight
  if (opts.fillWidth) params.FillWidth = opts.fillWidth
  if (opts.fillHeight) params.FillHeight = opts.fillHeight
  if (opts.quality) params.Quality = opts.quality
  params.ImageIndex = opts.imageIndex ?? 0
  const qs = buildQuery(params)
  return `${base}/Items/${itemId}/Images/${type}${qs ? `?${qs}` : ''}`
}

function placeholder(type: ImageType, _opts: ImageUrlOptions): string {
  // 简单纯色占位图（SVG data URI）。颜色按类型略作区分。
  const colors: Record<ImageType, string> = {
    Primary: '#1f2937',
    Art: '#111827',
    Backdrop: '#0b1220',
    Banner: '#1f2937',
    Logo: '#0b1220',
    Thumb: '#111827',
    Disc: '#1f2937',
    Box: '#111827',
    Screenshot: '#0b1220',
    Menu: '#1f2937',
    Chapter: '#111827',
    BoxRear: '#1f2937',
    Profile: '#0b1220',
  }
  const color = colors[type] ?? '#101114'
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='${color}'/></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

/** 便捷函数：Primary 海报 */
export function posterUrl(
  item: { id?: string; imageTags?: Record<string, string> },
  opts: ImageUrlOptions = {},
) {
  return getImageUrl(item.id, 'Primary', item.imageTags?.['Primary'], opts)
}

/** 便捷函数：Backdrop 背景 */
export function backdropUrl(
  item: {
    id?: string
    backdropImageTags?: string[]
    parentBackdropImageTags?: string[]
    parentBackdropItemId?: string
    imageTags?: Record<string, string>
  },
  opts: ImageUrlOptions = {},
) {
  if (item.backdropImageTags?.[0]) {
    return getImageUrl(item.id, 'Backdrop', item.backdropImageTags[0], { ...opts, imageIndex: 0 })
  }
  if (item.parentBackdropItemId && item.parentBackdropImageTags?.[0]) {
    return getImageUrl(
      item.parentBackdropItemId,
      'Backdrop',
      item.parentBackdropImageTags[0],
      { ...opts, imageIndex: 0 },
    )
  }
  return getImageUrl(item.id, 'Backdrop', item.imageTags?.['Backdrop'], opts)
}

/** 便捷函数：Thumb（剧集缩略图） */
export function thumbUrl(
  item: { id?: string; imageTags?: Record<string, string> },
  opts: ImageUrlOptions = {},
) {
  return getImageUrl(item.id, 'Thumb', item.imageTags?.['Thumb'], opts)
}

/** 便捷函数：Logo */
export function logoUrl(
  item: {
    id?: string
    imageTags?: Record<string, string>
    parentLogoImageTag?: string
    parentLogoItemId?: string
  },
  opts: ImageUrlOptions = {},
) {
  if (item.imageTags?.['Logo']) {
    return getImageUrl(item.id, 'Logo', item.imageTags['Logo'], opts)
  }
  if (item.parentLogoItemId && item.parentLogoImageTag) {
    return getImageUrl(item.parentLogoItemId, 'Logo', item.parentLogoImageTag, opts)
  }
  return ''
}
