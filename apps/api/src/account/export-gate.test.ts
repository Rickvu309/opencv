import { describe, expect, it } from "vitest"

import {
  createExportGate,
  EXPORT_ACCOUNT_BUSY,
  EXPORT_SERVICE_BUSY,
  EXPORT_TIMED_OUT,
  EXPORTS_AT_ONCE,
  gatedExport,
  type ExportArchive,
} from "./export-gate.js"

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

function elapsed(ms: number) {
  return new Promise((done) => setTimeout(done, ms))
}

describe("export gate", () => {
  it("lets one export per account run and refuses the rest with 429", async () => {
    const gate = createExportGate()
    const responses = await Promise.all(
      Array.from({ length: 20 }, () =>
        gatedExport(gate, "ada", async () => archive())
      )
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
    const gate = createExportGate()
    const owners = Array.from({ length: 12 }, (_, index) => `person-${index}`)
    const responses = await Promise.all(
      owners.map((owner) => gatedExport(gate, owner, async () => archive()))
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
    const gate = createExportGate()
    const first = await gatedExport(gate, "ada", async () => archive())
    const reader = first.body!.getReader()
    await reader.read()
    await reader.cancel()
    expect(gate.running()).toBe(0)
    const next = await gatedExport(gate, "ada", async () => archive())
    expect(next.status).toBe(200)
    expect(Buffer.from(await next.arrayBuffer()).toString()).toBe("PKbodyend")
  })

  it("releases the lock when building the export throws", async () => {
    const gate = createExportGate()
    await expect(
      gatedExport(gate, "ada", async () => {
        throw new Error("database went away")
      })
    ).rejects.toThrow("database went away")
    expect(gate.running()).toBe(0)
    const next = await gatedExport(gate, "ada", async () => archive())
    expect(next.status).toBe(200)
  })

  it("releases the lock and refuses when building outlasts the time limit", async () => {
    const gate = createExportGate()
    const slow = deferred()
    const pending = gatedExport(gate, "ada", () => slow.promise, 10)
    await elapsed(40)
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
    const gate = createExportGate()
    const res = await gatedExport(gate, "ada", async () => archive(), 10)
    expect(res.status).toBe(200)
    await elapsed(40)
    expect(gate.running()).toBe(0)
    await expect(res.arrayBuffer()).rejects.toThrow(EXPORT_TIMED_OUT)
  })

  it("lets an honest person export twice in a row", async () => {
    const gate = createExportGate()
    const first = await gatedExport(gate, "ada", async () => archive())
    expect(Buffer.from(await first.arrayBuffer()).toString()).toBe("PKbodyend")
    const second = await gatedExport(gate, "ada", async () => archive())
    expect(second.status).toBe(200)
    expect(second.headers.get("content-type")).toBe("application/zip")
    expect(second.headers.get("x-content-type-options")).toBe("nosniff")
    expect(Buffer.from(await second.arrayBuffer()).toString()).toBe("PKbodyend")
    expect(gate.running()).toBe(0)
  })

  it("frees the slot once the build ends when the person left while it was building", async () => {
    const gate = createExportGate()
    const slow = deferred()
    const gone = new AbortController()
    const pending = gatedExport(
      gate,
      "ada",
      () => slow.promise,
      60_000,
      gone.signal
    )
    gone.abort()
    expect(gate.running()).toBe(1)
    const built = archive()
    slow.resolve(built)
    const res = await pending
    expect(res.status).toBe(499)
    expect(built.chunks).toHaveLength(0)
    expect(gate.running()).toBe(0)
    const next = await gatedExport(gate, "ada", async () => archive())
    expect(next.status).toBe(200)
  })

  it("frees the slot when the person leaves before reading a built export", async () => {
    const gate = createExportGate()
    const gone = new AbortController()
    const built = archive()
    const res = await gatedExport(
      gate,
      "ada",
      async () => built,
      60_000,
      gone.signal
    )
    expect(gate.running()).toBe(1)
    gone.abort()
    expect(gate.running()).toBe(0)
    expect(built.chunks).toHaveLength(0)
    await expect(res.arrayBuffer()).rejects.toThrow()
  })

  it("does not free a newer export of the same person when an old request reports it left", async () => {
    const gate = createExportGate()
    const gone = new AbortController()
    const first = await gatedExport(
      gate,
      "ada",
      async () => archive(),
      60_000,
      gone.signal
    )
    await first.arrayBuffer()
    const slow = deferred()
    const second = gatedExport(gate, "ada", () => slow.promise)
    gone.abort()
    expect(gate.running()).toBe(1)
    slow.resolve(archive())
    await (await second).arrayBuffer()
    expect(gate.running()).toBe(0)
  })
})
