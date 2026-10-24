import type { LandingSurface, Shot } from "./landing-copy.ts"

export function LandingShot({ shot }: { shot: Shot }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-muted">
      <picture>
        <source
          media="(max-width: 767px)"
          srcSet={shot.mobileSrc}
          width={shot.mobileWidth}
          height={shot.mobileHeight}
        />
        <img
          src={shot.src}
          alt={shot.alt}
          width={shot.width}
          height={shot.height}
          loading="lazy"
          decoding="async"
          className="block h-auto w-full"
        />
      </picture>
    </div>
  )
}

export function LandingSurfaceSection({
  surface,
}: {
  surface: LandingSurface
}) {
  const headingId = `${surface.id}-title`

  return (
    <section
      id={surface.id}
      aria-labelledby={headingId}
      className="scroll-mt-32 py-16 md:scroll-mt-24 md:py-28 lg:py-36"
    >
      <div className="landing-frame">
        <div className="grid gap-6 md:grid-cols-2 md:items-start md:gap-12 lg:gap-16">
          <h2
            id={headingId}
            className="landing-section-title font-sans text-foreground"
          >
            {surface.title}
          </h2>
          <p className="max-w-xl text-lg leading-7 text-pretty text-muted-foreground md:text-2xl md:leading-8">
            {surface.body}
          </p>
        </div>
        <div className="mt-12 flex flex-col gap-4 md:mt-16 lg:mt-20">
          {surface.shots.map((shot) => (
            <LandingShot key={shot.src} shot={shot} />
          ))}
        </div>
        <div className="mt-8 grid gap-4 md:mt-10 md:grid-cols-2 md:gap-12 lg:gap-16">
          <p className="text-sm font-medium text-foreground">Features</p>
          <ul className="grid gap-x-12 gap-y-2.5 sm:grid-cols-2">
            {surface.features.map((feature) => (
              <li
                key={feature}
                className="text-sm font-medium text-muted-foreground"
              >
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
