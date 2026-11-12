import type { CSSProperties } from "react"
import { Calendar, Check, FileText, Kanban, Plug } from "lucide-react"

import { documentHref } from "@/lib/web-origins-env.ts"

import "./landing.css"
import "./pricing.css"
import { PRICING_TITLE } from "./landing-copy.ts"
import { landingPlanButton } from "./landing-button.ts"
import { LandingFooter } from "./landing-footer.tsx"
import { LandingNav } from "./landing-nav.tsx"
import { LandingClose } from "./landing-sections.tsx"
import {
  pricingDescription,
  pricingModel,
  type IncludedIconName,
  type PricingPlan,
} from "./pricing-model.ts"

const INCLUDED_ICON = {
  "file-text": FileText,
  kanban: Kanban,
  calendar: Calendar,
  plug: Plug,
} as const satisfies Record<IncludedIconName, typeof Check>

const metrics = pricingModel.metrics

function columnStyle(): CSSProperties {
  return { width: metrics.columnPx, maxWidth: "100%" }
}

function sectionTitleStyle(): CSSProperties {
  return {
    fontSize: metrics.sectionTitlePx,
    letterSpacing: metrics.sectionTrackingPx,
  }
}

function PlanCard({ plan }: { plan: PricingPlan }) {
  return (
    <article
      className="pricing-plan pricing-plan-free"
      style={{ padding: metrics.cardPadPx, borderRadius: metrics.cardRadiusPx }}
    >
      <div className="pricing-plan-name">
        <h2>{plan.name}</h2>
      </div>
      <p className="pricing-audience">{plan.audience}</p>
      <p className="pricing-price">
        <span
          className="pricing-price-amount"
          style={{
            fontSize: metrics.pricePx,
            letterSpacing: metrics.priceTrackingPx,
          }}
        >
          {plan.price}
        </span>
        <span className="pricing-price-period">{plan.period}</span>
      </p>
      <a
        href={documentHref("/sign-in")}
        className={`pricing-cta ${landingPlanButton(plan.tone)}`}
        style={{ blockSize: metrics.buttonPx, inlineSize: "100%" }}
      >
        {plan.cta}
      </a>
      <p className="pricing-note">{plan.note}</p>
      <hr className="pricing-plan-rule" />
      <ul className="pricing-features">
        {plan.features.map((feature) => (
          <li key={feature}>
            <Check aria-hidden size={15} />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
    </article>
  )
}

export function PricingPage() {
  const description = pricingDescription(pricingModel)
  return (
    <div className="pricing-page landing-root min-h-svh">
      <title>{PRICING_TITLE}</title>
      <meta name="description" content={description} />
      <LandingNav />
      <main
        className="pricing-main"
        style={{
          paddingInline: `max(1.25rem, calc((100% - ${metrics.columnPx}px) / 2))`,
        }}
      >
        <header
          className="pricing-header"
          style={{ paddingTop: metrics.padHeaderPx }}
        >
          <div
            className="pricing-column pricing-header-copy"
            style={{ ...columnStyle(), gap: metrics.headerGapPx }}
          >
            <h1
              id="pricing-title"
              style={{
                fontSize: metrics.titlePx,
                letterSpacing: metrics.titleTrackingPx,
                lineHeight: metrics.titleLineHeight,
              }}
            >
              {pricingModel.header.title}
            </h1>
            <p
              style={{
                fontSize: metrics.subheadPx,
                letterSpacing: metrics.subheadTrackingPx,
              }}
            >
              {pricingModel.header.subhead}
            </p>
          </div>
        </header>
        <section
          aria-label="Plans"
          className="pricing-plans"
          style={{ paddingTop: metrics.padPlansPx }}
        >
          <div
            className="pricing-column pricing-plan-row"
            style={{ ...columnStyle(), gap: metrics.plansGapPx }}
          >
            <PlanCard plan={pricingModel.plan} />
          </div>
        </section>
        <section
          aria-labelledby="included-title"
          className="pricing-block"
          style={{ paddingTop: metrics.padBlockPx }}
        >
          <div
            className="pricing-column pricing-stack"
            style={{ ...columnStyle(), gap: metrics.includedGapPx }}
          >
            <h2
              id="included-title"
              className="pricing-section-title"
              style={sectionTitleStyle()}
            >
              {pricingModel.included.title}
            </h2>
            <div
              className="pricing-included-grid"
              style={{ gap: metrics.includedRowGapPx }}
            >
              {pricingModel.included.items.map((item) => {
                const Icon = INCLUDED_ICON[item.icon]
                return (
                  <article key={item.title} className="pricing-included-item">
                    <span
                      className="pricing-tile"
                      style={{
                        width: metrics.tilePx,
                        height: metrics.tilePx,
                        borderRadius: metrics.tileRadiusPx,
                      }}
                    >
                      <Icon aria-hidden size={metrics.includedIconPx} />
                    </span>
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                  </article>
                )
              })}
            </div>
          </div>
        </section>
        <section
          aria-labelledby="faq-title"
          className="pricing-block"
          style={{ paddingTop: metrics.padBlockPx }}
        >
          <div
            className="pricing-column pricing-stack pricing-faq-copy"
            style={columnStyle()}
          >
            <h2
              id="faq-title"
              className="pricing-section-title"
              style={sectionTitleStyle()}
            >
              {pricingModel.faq.title}
            </h2>
            <div className="pricing-faq">
              {pricingModel.faq.items.map((item) => (
                <article
                  key={item.q}
                  style={{ paddingBlock: metrics.faqPadPx }}
                >
                  <h3>{item.q}</h3>
                  <p>{item.a}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <div
          className="pricing-prefooter"
          style={{ paddingTop: metrics.padPrefooterPx }}
        >
          <LandingClose />
        </div>
      </main>
      <div
        className="pricing-footer"
        style={{ marginTop: metrics.padFooterPx }}
      >
        <LandingFooter />
      </div>
    </div>
  )
}
