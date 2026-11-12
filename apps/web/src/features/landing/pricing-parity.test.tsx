import { readFileSync } from "node:fs"
import path from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, screen, within } from "@testing-library/react"

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
  compareHeadPx: 44,
  compareRowPx: 48,
  compareValuePx: 180,
} as const

function block(label: string) {
  const found = pricingModel.compare.blocks.find(
    (entry) => entry.label === label
  )
  expect(found, label).toBeDefined()
  return found!
}

function rowOf(feature: string): HTMLElement {
  const header = screen.getByRole("rowheader", { name: feature })
  const row = header.closest("tr")
  expect(row).not.toBeNull()
  return row as HTMLElement
}

describe("pricing snapshot", () => {
  it("keeps the frame geometry and the corrected compare", () => {
    expect(pricingSnapshot.source).toMatchObject({
      file: "design/opencv.pen",
      frameId: "q720Ng",
      frameName: "Pricing (Linear layout)",
      width: 1440,
    })
    expect(pricingModel.metrics).toMatchObject(SOURCE)
    expect(pricingModel.plans.free.price).toBe("$0")
    expect(pricingModel.plans.pro.price).toBe("$9")
    expect(pricingModel.plans.pro.kicker).toBe("For active search")
    expect(pricingModel.plans.free.surface).toBe("paper")
    expect(pricingModel.plans.pro.surface).toBe("mesh")
    expect(pricingModel.compare.blocks.map((entry) => entry.label)).toEqual([
      "Coach",
      "Paper",
      "Apply",
      "Support",
      "Coming soon",
    ])
    expect(block("Apply").rows.map((row) => row.feature)).toContain(
      "Integrations"
    )
    const priority = block("Support").rows.find(
      (row) => row.feature === "Priority support"
    )
    expect(priority?.free).toEqual({ kind: "dash" })
    expect(priority?.pro).toEqual({ kind: "check" })
    expect(block("Coming soon").rows.map((row) => row.feature)).toEqual([
      "Proof",
      "Pitch",
    ])
    expect(block("Coming soon").rows[0]?.pro).toEqual({
      kind: "text",
      value: "Early access",
    })
  })

  it("does not keep a second compare table in landing copy", () => {
    const copy = readFileSync(
      path.join(process.cwd(), "src/features/landing/landing-copy.ts"),
      "utf8"
    )
    expect(copy).not.toMatch(/PRICING_COMPARE|CompareCell|Not included/)
    const css = readFileSync(
      path.join(process.cwd(), "src/features/landing/pricing.css"),
      "utf8"
    )
    expect(css).toContain("var(--ring)")
    expect(css).toContain("var(--card)")
    expect(css).toContain("var(--background)")
    expect(css).toContain(`${pricingModel.metrics.prefooterGapPx}px`)
    expect(css).not.toMatch(/#(?:EEF1FA|8EA4E0|1B1B1F|C3D0F2)/i)
  })
})

describe("pricing page", () => {
  it("renders the snapshot, the prices, and the sign-in links", async () => {
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

    for (const name of ["Every plan includes", "Compare plans", "Questions"]) {
      expect(screen.getByRole("heading", { name })).toHaveStyle({
        fontSize: "24px",
        letterSpacing: "-0.4px",
      })
    }
    for (const blockEl of document.querySelectorAll(".pricing-block")) {
      expect((blockEl as HTMLElement).style.paddingTop).toBe("112px")
    }

    const free = screen.getByRole("heading", { level: 2, name: "Free" })
    const pro = screen.getByRole("heading", { level: 2, name: "Pro" })
    expect(free.parentElement).toHaveClass("pricing-plan-name")
    expect(free.parentElement).not.toHaveTextContent("For active search")
    expect(free.closest("article")).toHaveClass("pricing-plan-free")
    expect(pro.parentElement).toHaveClass("pricing-plan-name")
    expect(pro.parentElement).toHaveTextContent("For active search")
    expect(pro.closest("article")).toHaveClass("pricing-plan-pro")
    expect(free.closest("article")).toHaveStyle({
      padding: "32px",
      borderRadius: "24px",
    })

    expect(screen.getByText("$0")).toHaveStyle({ fontSize: "56px" })
    expect(screen.getByText("$9")).toHaveStyle({ fontSize: "56px" })

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

    const lead = screen.getByText("Everything in Free, plus")
    expect(lead.tagName).toBe("P")
    expect(lead.closest("li")).toBeNull()

    const included = document
      .getElementById("included-title")!
      .closest("section")!
    expect(included.querySelectorAll(".pricing-tile svg")).toHaveLength(4)
    expect(included.querySelector(".pricing-included-grid")).toHaveStyle({
      gap: "24px",
    })

    const table = screen.getByRole("table", { name: "Compare plans" })
    expect(table.querySelector("thead tr")).toHaveStyle({ height: "44px" })
    expect(
      within(table).queryByRole("columnheader", { name: "Integrations" })
    ).toBeNull()
    expect(
      within(table).getByRole("columnheader", { name: "Coming soon" })
    ).toBeInTheDocument()

    for (const group of pricingModel.compare.blocks) {
      for (const row of group.rows) {
        const rendered = rowOf(row.feature)
        const want = { check: 0, dash: 0 }
        for (const cell of [row.free, row.pro]) {
          if (cell.kind === "text") {
            expect(within(rendered).getByText(cell.value)).toBeInTheDocument()
          } else {
            want[cell.kind] += 1
          }
        }
        expect(
          within(rendered).queryAllByRole("img", { name: "Included" })
        ).toHaveLength(want.check)
        expect(
          within(rendered).queryAllByRole("img", { name: "Not included" })
        ).toHaveLength(want.dash)
        expect(rendered).toHaveStyle({ height: "48px" })
      }
    }

    const priority = rowOf("Priority support")
    expect(priority).not.toHaveTextContent("Coming soon")
    expect(
      within(priority).getAllByRole("img", { name: "Included" })
    ).toHaveLength(1)
    expect(
      within(priority).getAllByRole("img", { name: "Not included" })
    ).toHaveLength(1)

    const rows = within(table).getAllByRole("row")
    const labels = rows.map((row) =>
      row.textContent?.replace(/\s+/g, " ").trim()
    )
    const comingAt = labels.indexOf("Coming soon")
    expect(labels[comingAt + 1]).toMatch(/^Proof/)
    expect(labels[comingAt + 2]).toMatch(/^Pitch/)

    expect(screen.queryByText("Not included")).not.toBeInTheDocument()
    expect(screen.queryByText("Included")).not.toBeInTheDocument()
    expect(document.body).toHaveTextContent("\u2013")

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
