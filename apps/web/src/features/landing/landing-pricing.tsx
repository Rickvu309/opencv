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
  COMPARE_LABEL,
  pricingDescription,
  pricingModel,
  type CompareCell,
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
  const mesh = plan.surface === "mesh"
  return (
    <article
      className={
        mesh
          ? "pricing-plan pricing-plan-pro"
          : "pricing-plan pricing-plan-free"
      }
      style={{ padding: metrics.cardPadPx, borderRadius: metrics.cardRadiusPx }}
    >
      <div className="pricing-plan-name">
        <h2>{plan.name}</h2>
        {plan.kicker ? <p className="pricing-kicker">{plan.kicker}</p> : null}
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
      {plan.cta ? (
        <a
          href={documentHref("/sign-in")}
          className={`pricing-cta ${landingPlanButton(plan.tone)}`}
          style={{ blockSize: metrics.buttonPx, inlineSize: "100%" }}
        >
          {plan.cta}
        </a>
      ) : null}
      <p className="pricing-note">{plan.note}</p>
      <hr className="pricing-plan-rule" />
      {plan.lead ? <p className="pricing-lead">{plan.lead}</p> : null}
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

function CompareValue({ cell }: { cell: CompareCell }) {
  if (cell.kind === "check") {
    return <Check aria-label={COMPARE_LABEL.check} role="img" size={16} />
  }
  if (cell.kind === "dash") {
    return (
      <span className="pricing-dash" role="img" aria-label={COMPARE_LABEL.dash}>
        {"\u2013"}
      </span>
    )
  }
  return cell.value
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
            <PlanCard plan={pricingModel.plans.free} />
            <PlanCard plan={pricingModel.plans.pro} />
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
          aria-labelledby="compare-title"
          className="pricing-block"
          style={{ paddingTop: metrics.padBlockPx }}
        >
          <div
            className="pricing-column pricing-stack pricing-compare-copy"
            style={columnStyle()}
          >
            <h2
              id="compare-title"
              className="pricing-section-title"
              style={sectionTitleStyle()}
            >
              {pricingModel.compare.title}
            </h2>
            <div className="pricing-compare-scroll">
              <table
                className="pricing-compare-table"
                aria-labelledby="compare-title"
              >
                <thead>
                  <tr style={{ height: metrics.compareHeadPx }}>
                    <th scope="col">
                      <span className="sr-only">Feature</span>
                    </th>
                    {pricingModel.compare.columns.map((column) => (
                      <th
                        key={column}
                        scope="col"
                        style={{
                          width: `${(metrics.compareValuePx / metrics.columnPx) * 100}%`,
                        }}
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                {pricingModel.compare.blocks.map((block) => (
                  <tbody key={block.label}>
                    <tr className="pricing-compare-group">
                      <th
                        scope="colgroup"
                        colSpan={3}
                        style={{
                          paddingTop: metrics.compareGroupPadTopPx,
                          paddingBottom: metrics.compareGroupPadBottomPx,
                        }}
                      >
                        {block.label}
                      </th>
                    </tr>
                    {block.rows.map((row) => (
                      <tr
                        key={row.feature}
                        className="pricing-compare-row"
                        style={{ height: metrics.compareRowPx }}
                      >
                        <th scope="row">{row.feature}</th>
                        <td>
                          <CompareValue cell={row.free} />
                        </td>
                        <td>
                          <CompareValue cell={row.pro} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>
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
