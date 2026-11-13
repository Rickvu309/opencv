import { LIMITS } from "@workspace/domain"
import { Hono } from "hono"
import { describe, expect, it } from "vitest"

import { virtualClock } from "../limits/clock.js"
import { keyFor } from "../limits/key.js"
import { limited } from "../limits/limited.js"
import { memoryLedger } from "../limits/memory.js"
import { exportDownload, type ExportArchive } from "./export-download.js"

const spec = LIMITS["export.running"]
const EXPORT_ACCOUNT_BUSY = spec.says.key
const EXPORT_SERVICE_BUSY = spec.says.service
const EXPORT_TIMED_OUT = spec.says.expired
const EXPORTS_AT_ONCE = spec.shape.kind === "lease" ? spec.shape.total : 0

function archive(): ExportArchive {
  const chunks = [Buffer.from("PK"), Buffer.from("body"), Buffer.from("end")]
  return { chunks, byteLength: 9 }
}

function deferred() {
  let resolve: (value: ExportArchive) => void = () => {}
  const promise = new Promise<ExportArchive>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function holdMs() {
  if (spec.shape.kind !== "lease") throw new Error("export.running is a lease")
  return spec.shape.holdMs
}

function open(build: (owner: string) => Promise<ExportArchive>) {
  const clock = virtualClock()
  const ledger = memoryLedger(spec, clock)
  const gate = { running: () => ledger.peek().units }
  let current = build
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
      const built = await current(c.req.param("owner"))
      return exportDownload(built, c.req.raw.signal)
    }
  )
  return {
    app,
    gate,
    clock,
    use(next: (owner: string) => Promise<ExportArchive>) {
      current = next
    },
  }
}

describe("export gate", () => {
  it("lets one export per account run and refuses the rest with 429", async () => {
    const { app, gate } = open(async () => archive())
    const responses = await Promise.all(
      Array.from({ length: 20 }, () => app.request("/export/ada"))
    )
    const statuses = responses.map((res) => res.status)
    expect(statuses.filter((status) => status === 200)).toHaveLength(1)
    expect(statuses.filter((status) => status === 429)).toHaveLength(19)
    const refused = responses.find((res) => res.status === 429)!
    expect(refused.headers.get("retry-after")).toBe("30")
    expect(await refused.json()).toMatchObject({
      ok: false,
      error: { message: EXPORT_ACCOUNT_BUSY },
    })
    expect(gate.running()).toBe(1)
    await responses.find((res) => res.status === 200)!.arrayBuffer()
    expect(gate.running()).toBe(0)
  })

  it("never runs more exports across accounts than the ceiling and refuses with 503", async () => {
    const { app, gate } = open(async () => archive())
    const owners = Array.from({ length: 12 }, (_, index) => `person-${index}`)
    const responses = await Promise.all(
      owners.map((owner) => app.request(`/export/${owner}`))
    )
    const statuses = responses.map((res) => res.status)
    expect(statuses.filter((status) => status === 200)).toHaveLength(
      EXPORTS_AT_ONCE
    )
    expect(statuses.filter((status) => status === 503)).toHaveLength(
      owners.length - EXPORTS_AT_ONCE
    )
    const refused = responses.find((res) => res.status === 503)!
    expect(refused.headers.get("retry-after")).toBe("30")
    expect(await refused.json()).toMatchObject({
      error: { message: EXPORT_SERVICE_BUSY },
    })
    expect(gate.running()).toBe(EXPORTS_AT_ONCE)
    await Promise.all(
      responses
        .filter((res) => res.status === 200)
        .map((res) => res.arrayBuffer())
    )
    expect(gate.running()).toBe(0)
  })

  it("releases the lock when the client disconnects mid-export", async () => {
    const { app, gate } = open(async () => archive())
    const first = await app.request("/export/ada")
    const reader = first.body!.getReader()
    await reader.read()
    await reader.cancel()
    expect(gate.running()).toBe(0)
    const next = await app.request("/export/ada")
    expect(next.status).toBe(200)
    expect(Buffer.from(await next.arrayBuffer()).toString()).toBe("PKbodyend")
  })

  it("releases the lock when building the export throws", async () => {
    const { app, gate, use } = open(async () => {
      throw new Error("database went away")
    })
    await expect(app.request("/export/ada")).rejects.toThrow(
      "database went away"
    )
    expect(gate.running()).toBe(0)
    use(async () => archive())
    const next = await app.request("/export/ada")
    expect(next.status).toBe(200)
  })

  it("releases the lock and refuses when building outlasts the time limit", async () => {
    const slow = deferred()
    const { app, gate, clock } = open(() => slow.promise)
    const pending = app.request("/export/ada")
    clock.advance(holdMs())
    expect(gate.running()).toBe(0)
    slow.resolve(archive())
    const res = await pending
    expect(res.status).toBe(503)
    expect(await res.json()).toMatchObject({
      error: { message: EXPORT_TIMED_OUT },
    })
    expect(gate.running()).toBe(0)
  })

  it("releases the lock and stops a download nobody reads past the time limit", async () => {
    const { app, gate, clock } = open(async () => archive())
    const res = await app.request("/export/ada")
    expect(res.status).toBe(200)
    clock.advance(holdMs())
    expect(gate.running()).toBe(0)
    await expect(res.arrayBuffer()).rejects.toThrow(EXPORT_TIMED_OUT)
  })

  it("lets an honest person export twice in a row", async () => {
    const { app, gate } = open(async () => archive())
    const first = await app.request("/export/ada")
    expect(Buffer.from(await first.arrayBuffer()).toString()).toBe("PKbodyend")
    const second = await app.request("/export/ada")
    expect(second.status).toBe(200)
    expect(second.headers.get("content-type")).toBe("application/zip")
    expect(second.headers.get("x-content-type-options")).toBe("nosniff")
    expect(Buffer.from(await second.arrayBuffer()).toString()).toBe("PKbodyend")
    expect(gate.running()).toBe(0)
  })

  it("frees the slot once the build ends when the person left while it was building", async () => {
    const slow = deferred()
    const { app, gate } = open(() => slow.promise)
    const gone = new AbortController()
    const pending = app.request("/export/ada", { signal: gone.signal })
    gone.abort()
    expect(gate.running()).toBe(1)
    const built = archive()
    slow.resolve(built)
    const res = await pending
    expect(res.status).toBe(499)
    expect(built.chunks).toHaveLength(0)
    expect(gate.running()).toBe(0)
    const next = await app.request("/export/ada")
    expect(next.status).toBe(200)
  })

  it("frees the slot when the person leaves before reading a built export", async () => {
    const built = archive()
    const { app, gate } = open(async () => built)
    const gone = new AbortController()
    const res = await app.request("/export/ada", { signal: gone.signal })
    expect(gate.running()).toBe(1)
    gone.abort()
    expect(gate.running()).toBe(0)
    expect(built.chunks).toHaveLength(0)
    await expect(res.arrayBuffer()).rejects.toThrow()
  })

  it("does not free a newer export of the same person when an old request reports it left", async () => {
    const slow = deferred()
    const { app, gate, use } = open(async () => archive())
    const gone = new AbortController()
    const first = await app.request("/export/ada", { signal: gone.signal })
    await first.arrayBuffer()
    use(() => slow.promise)
    const second = app.request("/export/ada")
    gone.abort()
    expect(gate.running()).toBe(1)
    slow.resolve(archive())
    await (await second).arrayBuffer()
    expect(gate.running()).toBe(0)
  })
})
