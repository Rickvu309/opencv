import {
  APPLY_SCAN_EMPTY,
  APPLY_SCAN_FETCH_FAILED,
  APPLY_SCAN_NOT_FOUND,
  APPLY_SCAN_UNAVAILABLE,
  ERROR_CODES,
} from "@workspace/domain"
import { describe, expect, it } from "vitest"

import { createDemoCoachRuntime, withScanJobPosting } from "../coach/fake.js"
import {
  assertPublicApplyScanUrl,
  createFetchJobPosting,
  isBlockedApplyScanHost,
  isPrivateIPv4,
} from "./fetch-posting.js"
import { scanApplyPosting } from "./scan.js"

const JD = [
  "Local startup is hiring an Associate PM intern in Hanoi.",
  "Ship one discovery note this month. Apply by 12 September.",
].join(" ")

const CAFE_JD = [
  "Job Title: Café Barista Lead",
  "Company: Highlands Coffee",
  "Location: District 1, Ho Chi Minh City",
  "We need a café lead who owns the morning rush and trains new baristas.",
].join("\n")

function scanRuntime(text: string) {
  return withScanJobPosting(createDemoCoachRuntime(), async () => text)
}

describe("apply scan host guards", () => {
  it("blocks private and metadata hosts before fetch", () => {
    expect(isPrivateIPv4("127.0.0.1")).toBe(true)
    expect(isPrivateIPv4("10.0.0.8")).toBe(true)
    expect(isPrivateIPv4("169.254.169.254")).toBe(true)
    expect(isBlockedApplyScanHost("localhost")).toBe(true)
    expect(isBlockedApplyScanHost("metadata.google.internal")).toBe(true)
  })

  it("rejects the leftover jobs.example.com host and javascript URLs", async () => {
    await expect(
      assertPublicApplyScanUrl("https://jobs.example.com/associate-pm-intern")
    ).resolves.toEqual({ ok: false, message: APPLY_SCAN_FETCH_FAILED })
    await expect(
      assertPublicApplyScanUrl("javascript:alert(1)")
    ).resolves.toEqual({ ok: false, message: APPLY_SCAN_FETCH_FAILED })
  })
})

describe("scanApplyPosting", () => {
  it("extracts grounded title and company from pasted JD", async () => {
    const result = await scanApplyPosting({
      input: { jdText: JD },
      coach: scanRuntime(
        JSON.stringify({
          title: "Associate PM intern",
          company: "Local startup",
          note: "Hanoi",
        })
      ),
      fetchJobPosting: async () => {
        throw new Error("should not fetch when JD is pasted")
      },
    })
    expect(result).toEqual({
      ok: true,
      data: {
        title: "Associate PM intern",
        company: "Local startup",
        note: "Hanoi",
      },
    })
  })

  it("drops invented fields that are not in the post", async () => {
    const result = await scanApplyPosting({
      input: { jdText: JD },
      coach: scanRuntime(
        JSON.stringify({
          title: "Staff product manager",
          company: "Local startup",
          note: "Competitive salary and RSUs",
        })
      ),
      fetchJobPosting: async () => ({ ok: true, text: JD }),
    })
    expect(result).toEqual({
      ok: true,
      data: {
        title: null,
        company: "Local startup",
        note: null,
      },
    })
  })

  it("honest-fails when the model invents everything", async () => {
    const result = await scanApplyPosting({
      input: { jdText: JD },
      coach: scanRuntime(
        JSON.stringify({
          title: "Staff product manager",
          company: "Globex",
          note: "Unlimited PTO",
        })
      ),
      fetchJobPosting: async () => ({ ok: true, text: JD }),
    })
    expect(result).toEqual({
      ok: false,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: APPLY_SCAN_NOT_FOUND,
    })
  })

  it("reads JobPosting JSON-LD from a fetched URL without inventing", async () => {
    const html = `<!doctype html><html><head>
      <script type="application/ld+json">
        {"@type":"JobPosting","title":"Associate PM intern","hiringOrganization":{"name":"Local startup"}}
      </script>
    </head><body><p>Associate PM intern at Local startup in Hanoi.</p></body></html>`

    const result = await scanApplyPosting({
      input: { jobUrl: "https://careers.example.com/pm-intern" },
      fetchJobPosting: async (url) => {
        expect(url).toBe("https://careers.example.com/pm-intern")
        return { ok: true, text: html }
      },
    })
    expect(result).toEqual({
      ok: true,
      data: {
        title: "Associate PM intern",
        company: "Local startup",
        note: null,
      },
    })
  })

  it("asks the user to paste when the posting fetch fails", async () => {
    const result = await scanApplyPosting({
      input: { jobUrl: "https://careers.example.com/missing" },
      coach: scanRuntime("{}"),
      fetchJobPosting: async () => ({
        ok: false,
        message: APPLY_SCAN_FETCH_FAILED,
      }),
    })
    expect(result).toEqual({
      ok: false,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: APPLY_SCAN_FETCH_FAILED,
    })
  })

  it("honest-fails when scan AI is missing and the post has no JobPosting markup", async () => {
    const result = await scanApplyPosting({
      input: { jdText: JD },
      coach: createDemoCoachRuntime(),
      fetchJobPosting: async () => ({ ok: true, text: JD }),
    })
    expect(result).toEqual({
      ok: false,
      code: ERROR_CODES.COACH_UNAVAILABLE,
      message: APPLY_SCAN_UNAVAILABLE,
    })
  })

  it("requires a posting URL or JD text", async () => {
    const result = await scanApplyPosting({
      input: {},
      coach: scanRuntime("{}"),
      fetchJobPosting: async () => ({ ok: true, text: JD }),
    })
    expect(result).toEqual({
      ok: false,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: APPLY_SCAN_EMPTY,
    })
  })

  it("fills the same labeled JD twice when the model flakes on the second scan", async () => {
    let calls = 0
    const coach = withScanJobPosting(createDemoCoachRuntime(), async () => {
      calls += 1
      if (calls === 1) {
        return JSON.stringify({
          title: "Café Barista Lead",
          company: "Highlands Coffee",
          note: "District 1, Ho Chi Minh City",
        })
      }
      return JSON.stringify({ title: null, company: null, note: null })
    })
    const fetchJobPosting = async () => {
      throw new Error("should not fetch when JD is pasted")
    }

    const first = await scanApplyPosting({
      input: { jdText: CAFE_JD },
      coach,
      fetchJobPosting,
    })
    const second = await scanApplyPosting({
      input: { jdText: `${CAFE_JD} ` },
      coach,
      fetchJobPosting,
    })

    expect(first).toMatchObject({
      ok: true,
      data: {
        title: "Café Barista Lead",
        company: "Highlands Coffee",
      },
    })
    expect(second).toMatchObject({
      ok: true,
      data: {
        title: "Café Barista Lead",
        company: "Highlands Coffee",
      },
    })
    expect(calls).toBe(2)
  })

  it("reads labeled title and company when the model returns empty", async () => {
    const result = await scanApplyPosting({
      input: { jdText: CAFE_JD },
      coach: scanRuntime("{}"),
      fetchJobPosting: async () => {
        throw new Error("should not fetch when JD is pasted")
      },
    })
    expect(result).toEqual({
      ok: true,
      data: {
        title: "Café Barista Lead",
        company: "Highlands Coffee",
        note: "District 1, Ho Chi Minh City",
      },
    })
  })

  it("honest-fails garbage JD that has no labeled title or company", async () => {
    const result = await scanApplyPosting({
      input: { jdText: "Come work with us. Nice people." },
      coach: scanRuntime("{}"),
      fetchJobPosting: async () => ({ ok: true, text: JD }),
    })
    expect(result).toEqual({
      ok: false,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: APPLY_SCAN_NOT_FOUND,
    })
  })
})

describe("createFetchJobPosting", () => {
  it("does not call fetch for a private host", async () => {
    const fetchImpl = async () => {
      throw new Error("must not fetch localhost")
    }
    const fetchPosting = createFetchJobPosting({
      fetchImpl: fetchImpl as typeof fetch,
      lookupImpl: null,
    })
    await expect(fetchPosting("http://127.0.0.1/secret")).resolves.toEqual({
      ok: false,
      message: APPLY_SCAN_FETCH_FAILED,
    })
  })
})
