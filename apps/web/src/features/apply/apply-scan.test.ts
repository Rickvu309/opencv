import { describe, expect, it } from "vitest"
import {
  APPLY_SCAN_EMPTY,
  APPLY_SCAN_FETCH_FAILED,
  APPLY_SCAN_NOT_FOUND,
  applyScanFieldGrounded,
  applyScanFieldLooksUnreadable,
  extractApplyFieldsFromHiringText,
  extractApplyFieldsFromLabeledText,
  extractApplyFieldsFromMarkup,
  formatApplyScanReceipt,
  groundApplyScanResult,
  isUnreadableApplyPosting,
  parseApplyScanInput,
  parseApplyScanModelText,
  postingTextFromHtml,
} from "@workspace/domain"

const CAFE_JD = [
  "Job Title: Café Barista Lead",
  "Company: Highlands Coffee",
  "Location: District 1, Ho Chi Minh City",
  "We need a café lead who owns the morning rush and trains new baristas.",
].join("\n")

describe("apply scan helpers", () => {
  it("requires a posting URL or JD text", () => {
    expect(parseApplyScanInput({ jobUrl: "", jdText: "  " })).toEqual({
      ok: false,
      message: APPLY_SCAN_EMPTY,
    })
  })

  it("accepts a café URL paste or JD text", () => {
    expect(
      parseApplyScanInput({ jobUrl: "linkedin.com/jobs/view/123" })
    ).toEqual({
      ok: true,
      jobUrl: "https://linkedin.com/jobs/view/123",
      jdText: null,
    })
    expect(
      parseApplyScanInput({
        jdText: "Local startup is hiring an Associate PM intern.",
      })
    ).toEqual({
      ok: true,
      jobUrl: null,
      jdText: "Local startup is hiring an Associate PM intern.",
    })
  })

  it("grounds extracted fields in the posting text", () => {
    const source = "Local startup is hiring an Associate PM intern in Hanoi."
    expect(
      groundApplyScanResult(source, {
        title: "Associate PM intern",
        company: "Local startup",
        note: "Hanoi",
      })
    ).toEqual({
      title: "Associate PM intern",
      company: "Local startup",
      note: "Hanoi",
    })
    expect(
      groundApplyScanResult(source, {
        title: "Staff product manager",
        company: "Globex",
        note: "Unlimited PTO",
      })
    ).toEqual({ title: null, company: null, note: null })
    expect(applyScanFieldGrounded(source, "intern")).toBe(true)
    expect(applyScanFieldGrounded(CAFE_JD, "Cafe Barista Lead")).toBe(true)
    expect(APPLY_SCAN_NOT_FOUND).toMatch(/title or company/)
  })

  it("reads labeled title and company from a café paste", () => {
    expect(extractApplyFieldsFromLabeledText(CAFE_JD)).toEqual({
      title: "Café Barista Lead",
      company: "Highlands Coffee",
      note: "District 1, Ho Chi Minh City",
    })
    expect(
      extractApplyFieldsFromLabeledText("Come work with us. Nice people.")
    ).toEqual({ title: null, company: null, note: null })
    expect(
      groundApplyScanResult(
        CAFE_JD,
        extractApplyFieldsFromLabeledText(`${CAFE_JD} `)
      )
    ).toEqual({
      title: "Café Barista Lead",
      company: "Highlands Coffee",
      note: "District 1, Ho Chi Minh City",
    })
  })

  it("reads title and company from café hiring prose (QVE-251)", () => {
    const source =
      "Local startup is hiring an Associate PM intern in Hanoi. Apply by 12 September."
    expect(extractApplyFieldsFromHiringText(source)).toEqual({
      title: "Associate PM intern",
      company: "Local startup",
      note: "Hanoi",
    })
    expect(
      groundApplyScanResult(source, extractApplyFieldsFromHiringText(source))
    ).toEqual({
      title: "Associate PM intern",
      company: "Local startup",
      note: "Hanoi",
    })
    expect(
      extractApplyFieldsFromHiringText("Come work with us. Nice people.")
    ).toEqual({ title: null, company: null, note: null })
    expect(extractApplyFieldsFromHiringText(CAFE_JD)).toEqual({
      title: null,
      company: null,
      note: null,
    })
  })

  it("parses model JSON fail-closed and reads JobPosting markup", () => {
    expect(
      parseApplyScanModelText(
        'Sure.\n```json\n{"title":"Associate PM intern","company":null,"note":null}\n```'
      )
    ).toEqual({
      title: "Associate PM intern",
      company: null,
      note: null,
    })
    expect(parseApplyScanModelText("not json")).toEqual({
      title: null,
      company: null,
      note: null,
    })

    const html = `<script type="application/ld+json">{"@type":"JobPosting","title":"Associate PM intern","hiringOrganization":{"name":"Local startup"}}</script><p>Nice people.</p>`
    expect(extractApplyFieldsFromMarkup(html)).toEqual({
      title: "Associate PM intern",
      company: "Local startup",
      note: null,
    })
    expect(postingTextFromHtml(html)).toContain("Nice people")
    expect(postingTextFromHtml(html)).not.toContain("JobPosting")
    expect(
      formatApplyScanReceipt({
        title: "Associate PM intern",
        company: "Local startup",
        note: null,
      })
    ).toBe("Associate PM intern at Local startup")
  })

  it("treats a Page not found shell as unreadable, not a fill (QVE-249)", () => {
    const html = `<!doctype html><html><body>
      <h1>Page not found</h1>
      <nav>Microsoft Careers</nav>
    </body></html>`
    const text = postingTextFromHtml(html)
    expect(isUnreadableApplyPosting(text)).toBe(true)
    expect(applyScanFieldLooksUnreadable("Page not found")).toBe(true)
    expect(applyScanFieldLooksUnreadable("Microsoft")).toBe(false)
    expect(isUnreadableApplyPosting(CAFE_JD)).toBe(false)
    expect(APPLY_SCAN_FETCH_FAILED).toMatch(/paste the job text/i)

    expect(
      groundApplyScanResult(text, {
        title: null,
        company: "Microsoft",
        note: "Page not found",
      })
    ).toEqual({ title: null, company: "Microsoft", note: null })
  })
})
