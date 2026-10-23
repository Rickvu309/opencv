import { APPLY_SCAN_FETCH_FAILED } from "@workspace/domain"
import { describe, expect, it, vi } from "vitest"

import {
  assertPublicApplyScanUrl,
  createFetchJobPosting,
  isBlockedApplyScanHost,
  type JobPostingLookup,
} from "./fetch-posting.js"

const publicLookup: JobPostingLookup = async () => ({
  address: "93.184.216.34",
  family: 4,
})

const failed = { ok: false, message: APPLY_SCAN_FETCH_FAILED }

describe("isBlockedApplyScanHost", () => {
  it("allows fda.gov, fdic.gov and fcbarcelona.com", () => {
    for (const host of ["fda.gov", "fdic.gov", "fcbarcelona.com"]) {
      expect(isBlockedApplyScanHost(host)).toBe(false)
    }
  })

  it("still blocks private IPv6 literals", () => {
    for (const host of ["[::1]", "[fe80::1]", "[fd00::1]", "[fc00::1]"]) {
      expect(isBlockedApplyScanHost(host)).toBe(true)
    }
  })
})

describe("assertPublicApplyScanUrl", () => {
  it("passes a public employer whose name starts with fd", async () => {
    expect(await assertPublicApplyScanUrl("https://fda.gov/jobs/1")).toEqual({
      ok: true,
      url: "https://fda.gov/jobs/1",
    })
  })

  it("blocks userinfo and port shapes", async () => {
    for (const url of [
      "http://user@127.0.0.1/x",
      "http://localhost:3000/x",
      "http://[::1]:8080/x",
    ]) {
      expect(await assertPublicApplyScanUrl(url)).toEqual(failed)
    }
    const lookup = vi.fn(publicLookup)
    const result = await assertPublicApplyScanUrl(
      "https://example.com:8443/jobs",
      lookup
    )
    expect(result.ok).toBe(true)
    expect(lookup).toHaveBeenCalledWith("example.com")
  })

  it("blocks IPv4-mapped loopback and private addresses", async () => {
    for (const url of [
      "http://[::ffff:127.0.0.1]/x",
      "http://[::ffff:7f00:1]/x",
      "http://[::ffff:10.0.0.1]/x",
      "http://[::ffff:a9fe:a9fe]/x",
      "http://[::ffff:c0a8:1]:8080/x",
      "http://user@[::ffff:127.0.0.1]/x",
    ]) {
      expect(await assertPublicApplyScanUrl(url)).toEqual(failed)
    }
  })

  it("blocks a lookup that answers an IPv4-mapped private address", async () => {
    const lookup: JobPostingLookup = async () => ({
      address: "::ffff:7f00:1",
      family: 6,
    })
    expect(
      await assertPublicApplyScanUrl("https://example.com/x", lookup)
    ).toEqual(failed)
  })
})

function streamOf(chunks: Array<Uint8Array | Error>, onCancel?: () => void) {
  let index = 0
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[index]
      index += 1
      if (chunk === undefined) controller.close()
      else if (chunk instanceof Error) controller.error(chunk)
      else controller.enqueue(chunk)
    },
    cancel() {
      onCancel?.()
    },
  })
}

function fetcherFor(response: Response) {
  return createFetchJobPosting({
    fetchImpl: (async () => response) as unknown as typeof fetch,
    lookupImpl: publicLookup,
  })
}

describe("createFetchJobPosting body read", () => {
  it("returns the posting text for a small body", async () => {
    const body = streamOf([new TextEncoder().encode("Engineer at Acme")])
    expect(
      await fetcherFor(new Response(body))("https://example.com/j")
    ).toEqual({ ok: true, text: "Engineer at Acme" })
  })

  it("returns the fetch-failed result when the body read aborts", async () => {
    const body = streamOf([
      new Uint8Array(1_000).fill(97),
      new Error("connection reset"),
    ])
    expect(
      await fetcherFor(new Response(body))("https://example.com/j")
    ).toEqual(failed)
  })

  it("stops reading at 512 KB", async () => {
    let cancelled = false
    let pulled = 0
    const chunk = new Uint8Array(64_000).fill(97)
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += chunk.byteLength
        controller.enqueue(chunk)
        if (pulled >= 2_000_000) controller.close()
      },
      cancel() {
        cancelled = true
      },
    })
    expect(
      await fetcherFor(new Response(body))("https://example.com/j")
    ).toEqual(failed)
    expect(cancelled).toBe(true)
    expect(pulled).toBeLessThan(1_000_000)
  })

  it("rejects early when content-length exceeds the cap", async () => {
    let cancelled = false
    const body = streamOf([new Uint8Array(10)], () => {
      cancelled = true
    })
    const response = new Response(body, {
      headers: { "content-length": "3000000" },
    })
    expect(await fetcherFor(response)("https://example.com/j")).toEqual(failed)
    expect(cancelled).toBe(true)
  })

  it("returns the fetch-failed result for an empty body", async () => {
    expect(
      await fetcherFor(new Response("   "))("https://example.com/j")
    ).toEqual(failed)
  })
})
