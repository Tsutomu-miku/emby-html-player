import type { BaseItemDto } from '@/api/types'
import { backdropUrl } from '@/api/images'
import './HeroWallpaper.scss'

export interface HeroWallpaperProps {
  item?: BaseItemDto | null
  /** Percentage of viewport height covered by the wallpaper fade-out. */
  heightRems?: number
}

/**
 * Atmospheric home-page backdrop that sits behind TopBar + the first 1-2 home
 * sections ("继续播放" / 部分 "下一集").
 *
 * - If a hero `item` is given, uses its Backdrop image (low-opacity + blurred
 *   so it works as a mood layer rather than competing with the hero card).
 * - Always layers a dramatic sky/cloud CSS gradient mural underneath so the
 *   effect works even without an image (first load / empty resume list).
 */
export function HeroWallpaper({ item, heightRems = 36 }: HeroWallpaperProps) {
  const image = item
    ? backdropUrl(item, { quality: 72, maxWidth: 1920, placeholderOnMissing: false })
    : ''

  return (
    <div
      aria-hidden="true"
      className="hero-wallpaper"
      style={{ height: `${heightRems}rem` }}
    >
      <div className="hero-wallpaper__sky" />
      <div className="hero-wallpaper__clouds" />
      <div className="hero-wallpaper__mountains" />
      {image ? (
        <img
          src={image}
          alt=""
          className="hero-wallpaper__photo"
          loading="eager"
          decoding="async"
        />
      ) : null}
      <div className="hero-wallpaper__vignette" />
      <div className="hero-wallpaper__fade" />
    </div>
  )
}
