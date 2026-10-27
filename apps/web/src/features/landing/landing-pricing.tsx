import { documentHref } from "@/lib/web-origins-env.ts"

import { buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import "./landing.css"
import {
  PRICING_COMPARE,
  PRICING_DESCRIPTION,
  PRICING_FAQ,
  PRICING_FREE,
  PRICING_HEADLINE,
  PRICING_INCLUDED,
  PRICING_PRO,
  PRICING_SUBHEAD,
  PRICING_TITLE,
} from "./landing-copy.ts"
import { LandingFooter } from "./landing-footer.tsx"
import { LandingNav } from "./landing-nav.tsx"
import { LandingClose } from "./landing-sections.tsx"

export function PricingPage() {
  return (
    <div className="landing-root min-h-svh">
      <title>{PRICING_TITLE}</title>
      <meta name="description" content={PRICING_DESCRIPTION} />
      <LandingNav />
      <main className="landing-grid">
        <section
          className="landing-section landing-stack"
          aria-labelledby="pricing-title"
        >
          <h1 id="pricing-title" className="landing-section-title">
            {PRICING_HEADLINE}
          </h1>
          <p className="landing-section-body">{PRICING_SUBHEAD}</p>
        </section>
        <section aria-label="Plans" className="landing-section">
          <div className="landing-plan-grid">
            <article className="landing-plan">
              <h2 className="text-lg font-semibold">{PRICING_FREE.name}</h2>
              <p className="text-muted-foreground">{PRICING_FREE.audience}</p>
              <p className="landing-plan-price">
                {PRICING_FREE.price}{" "}
                <span className="text-base font-normal text-muted-foreground">
                  {PRICING_FREE.period}
                </span>
              </p>
              <a
                href={documentHref("/sign-in")}
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "rounded-full"
                )}
              >
                {PRICING_FREE.cta}
              </a>
              <p className="text-sm text-muted-foreground">
                {PRICING_FREE.note}
              </p>
              <ul className="landing-stack">
                {PRICING_FREE.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </article>
            <article className="landing-plan">
              <p className="text-sm font-medium">{PRICING_PRO.kicker}</p>
              <h2 className="text-lg font-semibold">{PRICING_PRO.name}</h2>
              <p className="text-muted-foreground">{PRICING_PRO.audience}</p>
              <p className="landing-plan-price">
                {PRICING_PRO.price}{" "}
                <span className="text-base font-normal text-muted-foreground">
                  {PRICING_PRO.period}
                </span>
              </p>
              <a
                href={documentHref("/sign-in")}
                className={cn(buttonVariants({ size: "lg" }), "rounded-full")}
              >
                {PRICING_PRO.cta}
              </a>
              <p className="text-sm text-muted-foreground">
                {PRICING_PRO.note}
              </p>
              <ul className="landing-stack">
                {PRICING_PRO.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </article>
          </div>
        </section>
        <section
          aria-labelledby="included-title"
          className="landing-section landing-stack"
        >
          <h2 id="included-title" className="landing-section-title">
            Every plan includes
          </h2>
          <div className="landing-plan-grid">
            {PRICING_INCLUDED.map((item) => (
              <article key={item.title} className="landing-stack">
                <h3 className="font-semibold">{item.title}</h3>
                <p className="text-muted-foreground">{item.body}</p>
              </article>
            ))}
          </div>
        </section>
        <section
          aria-labelledby="compare-title"
          className="landing-section landing-stack"
        >
          <h2 id="compare-title" className="landing-section-title">
            Compare plans
          </h2>
          <div className="landing-compare">
            <p className="text-sm text-muted-foreground">Feature</p>
            <p className="text-sm font-medium">Free</p>
            <p className="text-sm font-medium">Pro</p>
            {PRICING_COMPARE.map((group) => (
              <div key={group.group} className="contents">
                <h3 className="col-span-full font-semibold">{group.group}</h3>
                {group.rows.map((row) => (
                  <div key={row.feature} className="contents">
                    <p>{row.feature}</p>
                    <p>{row.free}</p>
                    <p>{row.pro}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
        <section
          aria-labelledby="faq-title"
          className="landing-section landing-stack"
        >
          <h2 id="faq-title" className="landing-section-title">
            Questions
          </h2>
          <div className="landing-faq">
            {PRICING_FAQ.map((item) => (
              <article key={item.q}>
                <h3>{item.q}</h3>
                <p>{item.a}</p>
              </article>
            ))}
          </div>
        </section>
        <LandingClose />
      </main>
      <LandingFooter />
    </div>
  )
}
