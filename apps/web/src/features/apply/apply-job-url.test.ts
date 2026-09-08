import { describe, expect, it } from "vitest"
import {
  APPLY_JOB_URL_INVALID,
  openableApplyJobUrl,
  parseApplyJobUrlInput,
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
    expect(
      parseApplyJobUrlInput("https://jobs.example.com/associate-pm-intern")
    ).toEqual({
      ok: true,
      jobUrl: "https://jobs.example.com/associate-pm-intern",
    })
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
