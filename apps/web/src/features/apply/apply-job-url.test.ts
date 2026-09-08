import { describe, expect, it } from "vitest"
import {
  APPLY_JOB_URL_INVALID,
  isDemoApplyJobUrl,
  openableApplyJobUrl,
  parseApplyJobUrlInput,
  publicApplyJobUrl,
} from "@workspace/domain"

describe("apply job URL helpers", () => {
  it("treats a blank paste as no URL", () => {
    expect(parseApplyJobUrlInput("")).toEqual({ ok: true, jobUrl: null })
    expect(parseApplyJobUrlInput("   ")).toEqual({ ok: true, jobUrl: null })
    expect(openableApplyJobUrl(null)).toBeNull()
  })

  it("normalizes a café-student paste without a scheme", () => {
    expect(parseApplyJobUrlInput("linkedin.com/jobs/view/123")).toEqual({
      ok: true,
      jobUrl: "https://linkedin.com/jobs/view/123",
    })
  })

  it("keeps an http(s) posting URL", () => {
    expect(parseApplyJobUrlInput("https://linkedin.com/jobs/view/123")).toEqual(
      {
        ok: true,
        jobUrl: "https://linkedin.com/jobs/view/123",
      }
    )
  })

  it("does not open the leftover seeded jobs.example.com host", () => {
    expect(
      isDemoApplyJobUrl("https://jobs.example.com/associate-pm-intern")
    ).toBe(true)
    expect(
      publicApplyJobUrl("https://jobs.example.com/associate-pm-intern")
    ).toBeNull()
    expect(
      openableApplyJobUrl("https://jobs.example.com/associate-pm-intern")
    ).toBeNull()
    expect(parseApplyJobUrlInput("https://jobs.example.com/foo")).toEqual({
      ok: false,
      message: APPLY_JOB_URL_INVALID,
    })
    expect(publicApplyJobUrl("https://linkedin.com/jobs/view/123")).toBe(
      "https://linkedin.com/jobs/view/123"
    )
  })

  it("honest-fails javascript and other non-web schemes", () => {
    expect(parseApplyJobUrlInput("javascript:alert(1)")).toEqual({
      ok: false,
      message: APPLY_JOB_URL_INVALID,
    })
    expect(openableApplyJobUrl("javascript:alert(1)")).toBeNull()
    expect(parseApplyJobUrlInput("not a url")).toEqual({
      ok: false,
      message: APPLY_JOB_URL_INVALID,
    })
  })
})
