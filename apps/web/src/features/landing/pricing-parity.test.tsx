import { readFileSync } from "node:fs"
import path from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, screen } from "@testing-library/react"

import { setMockSession } from "@/test/auth-client-mock.ts"
import { renderApp } from "@/test/render-app.tsx"

import { pricingSnapshot } from "./design/pricing.snapshot.ts"
import { pricingModel } from "./pricing-model.ts"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const SOURCE = {
  columnPx: 880,
  titlePx: 56,
  headerGapPx: 20,
  subheadPx: 22,
  padHeaderPx: 96,
  padPlansPx: 64,
  padBlockPx: 112,
  padPrefooterPx: 224,
  padFooterPx: 160,
  prefooterGapPx: 40,
  plansGapPx: 24,
  cardPadPx: 32,
  cardRadiusPx: 24,
  buttonPx: 44,
  pricePx: 56,
  sectionTitlePx: 24,
  faqPadPx: 22,
} as const

describe("pricing snapshot", () => {
  it("keeps the frame geometry", () => {
    expect(pricingSnapshot.source).toMatchObject({
      file: "design/opencv.pen",
      frameId: "q720Ng",
      frameName: "Pricing (Linear layout)",
      width: 1440,
    })
    expect(pricingModel.metrics).toMatchObject(SOURCE)
  })

  it("keeps only what is true without a purchase", () => {
    expect(pricingModel.plan).toMatchObject({
      name: "Free",
      price: "$0",
      cta: "Start free",
    })
    expect(pricingModel.plan.features).toEqual([
      "Limited Coach chats",
      "CVs and cover letters in Paper",
      "Board, list and calendar in Apply",
      "Integrations",
    ])
    expect(Object.keys(pricingModel)).not.toContain("compare")
    expect(pricingModel.header.subhead).toBe(
      "Start free. Coach has a daily limit."
    )
    expect(pricingModel.faq.items.map((item) => item.q)).toEqual([
      "What happens when I hit the Free limit?",
      "Is my data used to train models?",
    ])
  })

  it("keeps no compare table in landing copy", () => {
    const copy = readFileSync(
      path.join(process.cwd(), "src/features/landing/landing-copy.ts"),
      "utf8"
    )
    expect(copy).not.toMatch(/PRICING_COMPARE|CompareCell|Not included/)
    const css = readFileSync(
      path.join(process.cwd(), "src/features/landing/pricing.css"),
      "utf8"
    )
    expect(css).toContain("var(--card)")
    expect(css).toContain("var(--border)")
    expect(css).toContain(`${pricingModel.metrics.prefooterGapPx}px`)
    expect(css).not.toMatch(/#(?:EEF1FA|8EA4E0|1B1B1F|C3D0F2)/i)
  })
})

describe("pricing page", () => {
  it("renders the free plan as the only card with its sign-in link", async () => {
    setMockSession(null)
    renderApp("/pricing")

    expect(
      await screen.findByRole("heading", { level: 1, name: "Pricing" })
    ).toHaveStyle({
      fontSize: "56px",
      letterSpacing: "-1.6px",
      lineHeight: "1",
    })
    expect(screen.getByText(pricingModel.header.subhead)).toHaveStyle({
      fontSize: "22px",
    })

    const header = document.querySelector(".pricing-header") as HTMLElement
    const headerCopy = document.querySelector(
      ".pricing-header-copy"
    ) as HTMLElement
    expect(header.style.paddingTop).toBe("96px")
    expect(headerCopy.style.gap).toBe("20px")
    expect(headerCopy.style.width).toBe("880px")
    expect(headerCopy.style.maxWidth).toBe("100%")

    const plans = document.querySelector(".pricing-plans") as HTMLElement
    const planRow = document.querySelector(".pricing-plan-row") as HTMLElement
    expect(plans.style.paddingTop).toBe("64px")
    expect(planRow.style.gap).toBe("24px")
    expect(planRow.style.width).toBe("880px")
    expect(planRow.style.maxWidth).toBe("100%")

    for (const name of ["Every plan includes", "Questions"]) {
      expect(screen.getByRole("heading", { name })).toHaveStyle({
        fontSize: "24px",
        letterSpacing: "-0.4px",
      })
    }
    for (const blockEl of document.querySelectorAll(".pricing-block")) {
      expect((blockEl as HTMLElement).style.paddingTop).toBe("112px")
    }

    const free = screen.getByRole("heading", { level: 2, name: "Free" })
    expect(free.parentElement).toHaveClass("pricing-plan-name")
    expect(free.closest("article")).toHaveClass("pricing-plan-free")
    expect(free.closest("article")).toHaveStyle({
      padding: "32px",
      borderRadius: "24px",
    })
    expect(document.querySelectorAll(".pricing-plan")).toHaveLength(1)
    expect(
      screen.queryByRole("heading", { level: 2, name: "Pro" })
    ).not.toBeInTheDocument()

    expect(screen.getByText("$0")).toHaveStyle({ fontSize: "56px" })

    const start = screen.getByRole("link", { name: "Start free" })
    expect(start).toHaveAttribute("href", "/sign-in")
    expect(
      screen.queryByRole("link", { name: "Get Pro" })
    ).not.toBeInTheDocument()
    expect(document.querySelectorAll(".pricing-cta")).toHaveLength(1)
    expect(start.className).toContain("w-full")
    expect(start.className).toContain("4%")
    expect(start.style.blockSize).toBe("44px")
    expect(start.style.inlineSize).toBe("100%")

    const included = document
      .getElementById("included-title")!
      .closest("section")!
    expect(included.querySelectorAll(".pricing-tile svg")).toHaveLength(4)
    expect(included.querySelector(".pricing-included-grid")).toHaveStyle({
      gap: "24px",
    })

    expect(screen.queryByRole("table")).not.toBeInTheDocument()
    expect(document.body).not.toHaveTextContent(
      /\bPro\b|\$9|Stronger|Not on sale|Proof|Pitch|Cancel anytime/
    )

    const question = screen.getByRole("heading", {
      name: "What happens when I hit the Free limit?",
    })
    expect(question.closest("article")).toHaveStyle({ paddingBlock: "22px" })
    expect(question.closest(".pricing-faq")).not.toBeNull()

    const prefooter = document.querySelector(
      ".pricing-prefooter"
    ) as HTMLElement
    const footer = document.querySelector(".pricing-footer") as HTMLElement
    expect(prefooter.style.paddingTop).toBe("224px")
    expect(footer.style.marginTop).toBe("160px")
    expect(document.querySelector(".landing-close")).toHaveTextContent(
      /Be the obvious hire/
    )
  })
})
