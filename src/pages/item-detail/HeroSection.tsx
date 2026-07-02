export function HeroSection({
  backdropSrc,
}: {
  backdropSrc: string
}) {
  return (
    <section className="item-detail-hero" aria-hidden="true">
      <img
        src={backdropSrc}
        alt=""
        className="item-detail-hero__image"
        onError={(e) => {
          e.currentTarget.onerror = null
          e.currentTarget.style.visibility = 'hidden'
        }}
      />
      <div className="item-detail-hero__veil" />
    </section>
  )
}
