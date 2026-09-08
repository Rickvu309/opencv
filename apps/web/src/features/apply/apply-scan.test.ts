import { describe, expect, it } from "vitest"
import {
  APPLY_SCAN_EMPTY,
  APPLY_SCAN_NOT_FOUND,
  applyScanFieldGrounded,
  extractApplyFieldsFromMarkup,
  formatApplyScanReceipt,
  groundApplyScanResult,
  parseApplyScanInput,
  parseApplyScanModelText,
  postingTextFromHtml,
} from "@workspace/domain"

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
    expect(APPLY_SCAN_NOT_FOUND).toMatch(/title or company/)
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
})
