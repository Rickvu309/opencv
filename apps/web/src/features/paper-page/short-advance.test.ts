import { expect, it, vi } from "vitest"

import {
  isShortAdvance,
  markShortRegions,
  measureAdvances,
  shortAdvanceNote,
  type LineMeasure,
} from "./short-advance.ts"

function pair(
  text: string,
  nextText: string,
  runSizePx: number,
  advancePx: number
): LineMeasure {
  return {
    text,
    nextText,
    page: 1,
    nextPage: 1,
    section: "0",
    nextSection: "0",
    columnBreak: false,
    advancePx,
    runSizePx,
    sourceLine: 264,
  }
}

const cv13 = [
  pair(
    "Degree, Major • GPA (optional)Graduation Date Thesis [Note: Optional]",
    "Relevant Coursework: List selected courses, honors, or awards (optional)",
    16,
    15.6
  ),
  pair(
    "Study Abroad (if applicable)City, Country",
    "Study abroad coursework in [Field]Month Year – Month Year",
    16,
    14.6
  ),
  pair(
    "High School NameCity, State",
    "GPA, academic honors, or test scores (optional)Graduation Date",
    16,
    14.6
  ),
  pair("Leadership & Activities", "OrganizationCity, State", 18.7, 17.6),
]

const cv12 = [
  pair("📍 Chicago, IL", "✉️ john.miller@email.com", 12, 11.6),
  pair("LinkedIn: Profile Link", "---", 12, 8.7),
  pair(
    "Detail-oriented and certified accountant with 8+ years of experience in financia",
    "---",
    13.3,
    12.7
  ),
  pair(
    "Financial Reporting (GAAP & IFRS)",
    "Tax Preparation (Federal & State)",
    13.3,
    11.6
  ),
  pair(
    "QuickBooks, Excel (Pivot Tables, VLOOKUP)",
    "Reconciliations (Bank & General Ledger)",
    13.3,
    11.6
  ),
  pair("Reconciliations (Bank & General Ledger)", "---", 13.3, 12.7),
  pair(
    "Improved AR collections cycle, reducing overdue invoices by 40%",
    "---",
    13.3,
    12.6
  ),
  pair("University of Illinois at Chicago — Graduated 2015", "---", 14.7, 11.6),
  pair(
    "Certifications",
    "Certified Public Accountant (CPA) — Illinois Board of Examiners",
    16,
    15.6
  ),
  pair("QuickBooks ProAdvisor Certified", "---", 14.7, 11.7),
  pair("Additional Information", "Authorized to work in the U.S.", 16, 14.7),
]

it("keeps the recorded CV13 and CV12 pairs under the floor", () => {
  const notice = shortAdvanceNote([...cv13, ...cv12])
  expect(cv13.filter(isShortAdvance)).toHaveLength(4)
  expect(cv12.filter(isShortAdvance)).toHaveLength(11)
  expect(notice).toContain("Line spacing 264 (1.10) advances 15.6px")
  expect(notice).toContain('to "---"')
  expect(notice.match(/advances /g)).toHaveLength(15)
  expect(notice).not.toContain("Fonts substituted")
})

it("keeps a gap that clears the run-size floor", () => {
  const name = pair("ALEXANDER SMITH", "City", 21.3, 22.5)
  expect(isShortAdvance(name)).toBe(false)
  expect(shortAdvanceNote([name])).toBe("")
})

it("skips a gap that changes page, section, or follows a column break", () => {
  const changed = pair("Date", "Greeting", 16, 10)
  expect(isShortAdvance({ ...changed, nextPage: 2 })).toBe(false)
  expect(isShortAdvance({ ...changed, nextSection: "1" })).toBe(false)
  expect(isShortAdvance({ ...changed, columnBreak: true })).toBe(false)
})

function drawnPage(first: string, second: string) {
  const root = document.createElement("div")
  root.innerHTML = `<section class="docx"><article>
    <p data-line="264" data-section="0" style="font-size:16px">${first}</p>
    <p data-line="264" data-section="0" style="font-size:16px">${second}</p>
  </article></section>`
  return root
}

it("names a short gap only when that text was measured on the page", () => {
  const previous = Range.prototype.getClientRects
  Range.prototype.getClientRects = function () {
    const node = this.startContainer.parentElement?.closest("p")
    const peers = [...(node?.closest("article")?.querySelectorAll("p") ?? [])]
    const top = Math.max(0, peers.indexOf(node as HTMLParagraphElement)) * 10
    const rect = {
      top,
      height: 12,
      width: 8,
      left: 0,
      right: 8,
      bottom: top + 12,
      x: 0,
      y: top,
      toJSON() {
        return {}
      },
    }
    return [rect] as unknown as DOMRectList
  }
  const context = vi
    .spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockReturnValue({
      font: "",
      measureText: () => ({ actualBoundingBoxAscent: 8 }),
    } as unknown as CanvasRenderingContext2D)
  try {
    const root = drawnPage("Leadership &amp; Activities", "Organization")
    const notice = shortAdvanceNote(measureAdvances(root))
    expect(notice).toContain('from "Leadership & Activities"')
    expect(notice).toContain('to "Organization"')
    markShortRegions(root, measureAdvances(root))
    expect(root.querySelector("article p")).toHaveAttribute(
      "contenteditable",
      "false"
    )
    const other = drawnPage("Hello pages", "Next line")
    expect(shortAdvanceNote(measureAdvances(other))).not.toContain("Leadership")
  } finally {
    if (previous) Range.prototype.getClientRects = previous
    else delete Range.prototype.getClientRects
    context.mockRestore()
  }
})

it("marks the short region read-only and names the measured advance", () => {
  const root = document.createElement("div")
  root.innerHTML = `<article><p>Leadership &amp; Activities</p><p>OrganizationCity, State</p></article>`
  const line = cv13[3]
  if (!line) throw new Error("missing pair")
  markShortRegions(root, [line])
  const host = root.querySelector("article p")
  expect(host).toHaveAttribute("contenteditable", "false")
  expect(host).toHaveAttribute(
    "aria-label",
    "Read-only. Line spacing 264 advances 17.6px."
  )
})
