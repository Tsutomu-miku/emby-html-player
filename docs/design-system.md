# Design System Notes

This design language is distilled from `docs/ui/home.png` and
`docs/ui/filter.png`. It is a foundation for the Electron desktop app, not a
pixel-perfect copy of those references.

## Visual Direction

- Dark cinematic surfaces with subtle blue/green undertones.
- Glass panels for app chrome, filters, menus, and feature cards.
- Media artwork carries the page; UI chrome stays quiet and translucent.
- Green is the primary action and state color. Blue is reserved for secondary
  system feedback only.
- Borders are low-contrast but always visible enough to define card edges.

## Layout

- Desktop shell uses a fixed left navigation rail and a sticky glass top bar.
- Content max width is wide (`1600px`) with generous gutters.
- Home page prioritizes a hero continue-watching area, then library cards, then
  rows of media.
- Library page uses a compact toolbar before the grid: title, count, filters,
  view controls, and refresh/load affordances.

## Core Tokens

- Background: `#071018` to `#0d1720` radial/linear layered dark field.
- Panel: translucent `rgba(15, 23, 31, 0.72)`.
- Card: translucent `rgba(20, 30, 39, 0.78)`.
- Border: `rgba(255, 255, 255, 0.11)`.
- Primary: `#64d86b`.
- Primary strong: `#35b84a`.
- Text: `#f3f6f7`.
- Muted text: `#9aa6ad`.

## Motion

- Use `transform`, `opacity`, `filter`, and `box-shadow`; avoid layout-driving
  animations for lists and grids.
- Hover cards lift `2-4px`, brighten artwork, and reveal overlays.
- Buttons compress slightly on press.
- Dropdowns and menus fade/slide in over `140-180ms`.
- Loading uses shimmer skeletons and small spinners.
- Respect `prefers-reduced-motion` by disabling transitions and animations.

## Component Rules

- Glass surfaces: `glass-panel` for persistent chrome and `glass-card` for
  content cards.
- Icon buttons: square, 40px desktop target, visible focus ring.
- Poster cards: stable aspect ratio, progress rail at the bottom, watched check
  badge in the top-right, text outside cards in dense grids.
- Filters: compact pill/select controls with hover, focus, and active states.
- Empty/error/loading states should occupy the same page region as their content
  to prevent layout jumps.
