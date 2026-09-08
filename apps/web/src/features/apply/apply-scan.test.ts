import { describe, expect, it } from "vitest"
import {
  APPLY_SCAN_EMPTY,
  APPLY_SCAN_NOT_FOUND,
  applyScanFieldGrounded,
  extractApplyFieldsFromLabeledText,
  extractApplyFieldsFromMarkup,
  formatApplyScanReceipt,
  groundApplyScanResult,
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
