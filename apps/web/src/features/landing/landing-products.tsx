import { LandingFigure } from "./figures/landing-figure.tsx"
import { LANDING_PRODUCT_LINK, LANDING_PRODUCTS } from "./landing-copy.ts"
import { LandingSectionHeader } from "./landing-section-header.tsx"

export function LandingProducts() {
  return (
    <>
      {LANDING_PRODUCTS.map((product) => (
        <section
          key={product.id}
          id={product.id}
          aria-labelledby={`${product.id}-title`}
          className="landing-wide"
        >
          <LandingSectionHeader
            id={`${product.id}-title`}
            title={product.title}
            body={product.body}
            link={LANDING_PRODUCT_LINK}
          />
          <div className="landing-panel landing-gradient" data-crop="product">
            <LandingFigure id={product.figure} />
          </div>
        </section>
      ))}
    </>
  )
}
