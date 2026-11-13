import { LIMITS } from "@workspace/domain"
import { Hono } from "hono"
import { describe, expect, it } from "vitest"

import { exportDownload } from "../account/export-download.js"
import { virtualClock } from "./clock.js"
import { keyFor } from "./key.js"
import { limited } from "./limited.js"
import { memoryLedger } from "./memory.js"
import type { Ledger } from "./ledger.js"

const spec = LIMITS["export.running"]

type Archive = { chunks: Buffer[]; byteLength: number }

function archive(): Archive {
  const chunks = [Buffer.from("PK"), Buffer.from("body"), Buffer.from("end")]
  return { chunks, byteLength: 9 }
}

function deferred() {
  let resolve: (value: Archive) => void = () => {}
  const promise = new Promise<Archive>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function appFor(
  ledger: Ledger,
  clock: ReturnType<typeof virtualClock>,
  build: (owner: string) => Promise<Archive>
) {
  const app = new Hono()
  app.onError((error) => {
    throw error
  })
  app.get(
    "/export/:owner",
    limited(
      "export.running",
      (c) => keyFor("account", c.req.param("owner")),
      ledger,
      clock
    ),
    async (c) => {
      const built = await build(c.req.param("owner"))
      return exportDownload(built, c.req.raw.signal)
    }
  )
  return app
}

async function units(ledger: Ledger) {
  return (await ledger.held()).units
}

describe("one account export on the shared limit", () => {
  it("lets one export per account run and refuses the rest with 429", async () => {
    const clock = virtualClock()
    const ledger = memoryLedger(spec, clock)
    const app = appFor(ledger, clock, async () => archive())
    const responses = await Promise.all(
      Array.from({ length: 20 }, () => app.request("/export/ada"))
    )
    const statuses = responses.map((res) => res.status)
    expect(statuses.filter((status) => status === 200)).toHaveLength(1)
    expect(statuses.filter((status) => status === 429)).toHaveLength(19)
    const refused = responses.find((res) => res.status === 429)!
    expect(refused.headers.get("retry-after")).toBe("30")
    expect(refused.headers.get("x-limit")).toBe("export.running")
    expect(await refused.json()).toMatchObject({
      ok: false,
      error: { message: spec.says.key },
    })
    expect(await units(ledger)).toBe(1)
    await responses.find((res) => res.status === 200)!.arrayBuffer()
    expect(await units(ledger)).toBe(0)
  })

  it("never runs more exports across accounts than the ceiling and refuses with 503", async () => {
    const clock = virtualClock()
    const ledger = memoryLedger(spec, clock)
    const app = appFor(ledger, clock, async () => archive())
    const shape = spec.shape
    if (shape.kind !== "lease") throw new Error("export.running is a lease")
    const owners = Array.from({ length: 12 }, (_, index) => `person-${index}`)
    const responses = await Promise.all(
      owners.map((owner) => app.request(`/export/${owner}`))
    )
    const statuses = responses.map((res) => res.status)
    expect(statuses.filter((status) => status === 200)).toHaveLength(
      shape.total
    )
    expect(statuses.filter((status) => status === 503)).toHaveLength(
      owners.length - shape.total
    )
    const refused = responses.find((res) => res.status === 503)!
    expect(refused.headers.get("retry-after")).toBe("30")
    expect(refused.headers.get("x-limit")).toBe("export.running")
    expect(await refused.json()).toMatchObject({
      error: { message: spec.says.service },
    })
    expect(await units(ledger)).toBe(shape.total)
    await Promise.all(
      responses
        .filter((res) => res.status === 200)
        .map((res) => res.arrayBuffer())
    )
    expect(await units(ledger)).toBe(0)
  })

  it("releases the slot when the client disconnects mid-export", async () => {
    const clock = virtualClock()
    const ledger = memoryLedger(spec, clock)
    const app = appFor(ledger, clock, async () => archive())
    const first = await app.request("/export/ada")
    const reader = first.body!.getReader()
    await reader.read()
    await reader.cancel()
    expect(await units(ledger)).toBe(0)
    const next = await app.request("/export/ada")
    expect(next.status).toBe(200)
    expect(Buffer.from(await next.arrayBuffer()).toString()).toBe("PKbodyend")
  })

  it("releases the slot when building the export throws", async () => {
    const clock = virtualClock()
    const ledger = memoryLedger(spec, clock)
    const app = appFor(ledger, clock, async () => {
      throw new Error("database went away")
    })
    await expect(app.request("/export/ada")).rejects.toThrow(
      "database went away"
    )
    expect(await units(ledger)).toBe(0)
    const healthy = appFor(ledger, clock, async () => archive())
    const next = await healthy.request("/export/ada")
    expect(next.status).toBe(200)
  })

  it("releases the slot and refuses when building outlasts the time limit", async () => {
    const clock = virtualClock()
    const ledger = memoryLedger(spec, clock)
    const slow = deferred()
    const app = appFor(ledger, clock, () => slow.promise)
    const pending = app.request("/export/ada")
    expect(await units(ledger)).toBe(1)
    const shape = spec.shape
    if (shape.kind !== "lease") throw new Error("export.running is a lease")
    clock.advance(shape.holdMs)
    expect(await units(ledger)).toBe(0)
    slow.resolve(archive())
    const res = await pending
    expect(res.status).toBe(503)
    expect(res.headers.get("x-limit")).toBe("export.running")
    expect(await res.json()).toMatchObject({
      error: { message: spec.says.expired },
    })
    expect(await units(ledger)).toBe(0)
  })

  it("releases the slot and stops a download nobody reads past the time limit", async () => {
    const clock = virtualClock()
    const ledger = memoryLedger(spec, clock)
    const app = appFor(ledger, clock, async () => archive())
    const res = await app.request("/export/ada")
    expect(res.status).toBe(200)
    expect(await units(ledger)).toBe(1)
    const shape = spec.shape
    if (shape.kind !== "lease") throw new Error("export.running is a lease")
    clock.advance(shape.holdMs)
    expect(await units(ledger)).toBe(0)
    await expect(res.arrayBuffer()).rejects.toThrow(spec.says.expired)
  })

  it("lets an honest person export twice in a row", async () => {
    const clock = virtualClock()
    const ledger = memoryLedger(spec, clock)
    const app = appFor(ledger, clock, async () => archive())
    const first = await app.request("/export/ada")
    expect(Buffer.from(await first.arrayBuffer()).toString()).toBe("PKbodyend")
    const second = await app.request("/export/ada")
    expect(second.status).toBe(200)
    expect(second.headers.get("content-type")).toBe("application/zip")
    expect(second.headers.get("x-content-type-options")).toBe("nosniff")
    expect(Buffer.from(await second.arrayBuffer()).toString()).toBe("PKbodyend")
    expect(await units(ledger)).toBe(0)
  })

  it("frees the slot once the build ends when the person left while it was building", async () => {
    const clock = virtualClock()
    const ledger = memoryLedger(spec, clock)
    const slow = deferred()
    const app = appFor(ledger, clock, () => slow.promise)
    const gone = new AbortController()
    const pending = app.request("/export/ada", { signal: gone.signal })
    expect(await units(ledger)).toBe(1)
    gone.abort()
    expect(await units(ledger)).toBe(1)
    const built = archive()
    slow.resolve(built)
    const res = await pending
    expect(res.status).toBe(499)
    expect(built.chunks).toHaveLength(0)
    expect(await units(ledger)).toBe(0)
    const next = await app.request("/export/ada")
    expect(next.status).toBe(200)
  })

  it("frees the slot when the person leaves before reading a built export", async () => {
    const clock = virtualClock()
    const ledger = memoryLedger(spec, clock)
    const built = archive()
    const app = appFor(ledger, clock, async () => built)
    const gone = new AbortController()
    const res = await app.request("/export/ada", { signal: gone.signal })
    expect(await units(ledger)).toBe(1)
    gone.abort()
    expect(await units(ledger)).toBe(0)
    expect(built.chunks).toHaveLength(0)
    await expect(res.arrayBuffer()).rejects.toThrow()
  })

  it("does not free a newer export of the same person when an old request reports it left", async () => {
    const clock = virtualClock()
    const ledger = memoryLedger(spec, clock)
    const app = appFor(ledger, clock, async () => archive())
    const gone = new AbortController()
    const first = await app.request("/export/ada", { signal: gone.signal })
    await first.arrayBuffer()
    const slow = deferred()
    const secondApp = appFor(ledger, clock, () => slow.promise)
    const second = secondApp.request("/export/ada")
    expect(await units(ledger)).toBe(1)
    gone.abort()
    expect(await units(ledger)).toBe(1)
    slow.resolve(archive())
    await (await second).arrayBuffer()
    expect(await units(ledger)).toBe(0)
  })
})
