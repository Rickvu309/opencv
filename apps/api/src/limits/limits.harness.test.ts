import { LIMITS, SERVICE_MEMORY_BYTES } from "@workspace/domain"
import { describe, expect, it } from "vitest"

import { virtualClock } from "./clock.js"
import { keyFor } from "./key.js"
import { memoryLedger } from "./memory.js"
import { limitBounds } from "./bounds.js"
import { Limited } from "./refusal.js"
import { runLimit } from "./run.js"

const spec = LIMITS["export.running"]
const id = "export.running" as const

function account(name: string) {
  return keyFor("account", name)
}

function leaseLedger() {
  const clock = virtualClock(1_000_000)
  const ledger = memoryLedger(spec, clock)
  return { clock, ledger }
}

async function heldUnits(ledger: ReturnType<typeof memoryLedger>) {
  return (await ledger.held()).units
}

describe("export.running limit harness", () => {
  it("LIM-1 one key never holds more than its share of the export slots", async () => {
    const { clock, ledger } = leaseLedger()
    const key = account("ada")
    const shape = spec.shape
    if (shape.kind !== "lease") throw new Error("export.running is a lease")
    let granted = 0
    for (let i = 0; i < 20; i += 1) {
      const entered = await ledger.enter(key, clock.now())
      if (entered.granted) granted += 1
    }
    expect(granted).toBe(shape.perKey)
    const held = await ledger.held()
    expect(held.units / shape.total).toBeLessThanOrEqual(
      spec.accepts.oneKeyShare
    )
    expect(held.keys).toBe(1)
  })

  it("LIM-2 reports how many accounts it takes to refuse everyone else", async () => {
    const shape = spec.shape
    if (shape.kind !== "lease") throw new Error("export.running is a lease")
    const reports: Record<number, string> = {}
    for (const crowd of [1, 10, 100]) {
      const { clock, ledger } = leaseLedger()
      let holding = 0
      for (let i = 0; i < crowd; i += 1) {
        const entered = await ledger.enter(account(`crowd-${i}`), clock.now())
        if (entered.granted) holding += 1
      }
      const honest = await ledger.enter(account("honest"), clock.now())
      reports[crowd] = honest.granted
        ? "honest served"
        : `honest refused at ${honest.reach} while ${holding} hold slots`
      if (crowd < spec.accepts.keysToDenyAll) {
        expect(honest.granted).toBe(true)
      } else {
        expect(honest.granted).toBe(false)
        if (!honest.granted) expect(honest.reach).toBe("service")
      }
      expect(holding).toBe(Math.min(crowd, shape.total))
    }
    expect(reports[1]).toBe("honest served")
    expect(reports[10]).toContain("service")
    expect(reports[100]).toContain("service")
    expect(spec.accepts.keysToDenyAll).toBe(shape.total)
  })

  it("LIM-3 a stranger cannot refuse one chosen account at key level", async () => {
    expect(spec.scope).toBe("account")
    expect(spec.accepts.targetedDenialMs).toBe(0)
    const { clock, ledger } = leaseLedger()
    const attacker = await ledger.enter(account("attacker"), clock.now())
    expect(attacker.granted).toBe(true)
    const victim = await ledger.enter(account("victim"), clock.now())
    expect(victim.granted).toBe(true)
    const again = await ledger.enter(account("victim"), clock.now())
    expect(again.granted).toBe(false)
    if (!again.granted) expect(again.reach).toBe("key")
  })

  it("LIM-4 an honest account exporting twice in a row is never refused", async () => {
    const { clock, ledger } = leaseLedger()
    const key = account("ada")
    for (let i = 0; i < spec.honest.uses; i += 1) {
      const entered = await ledger.enter(key, clock.now())
      expect(entered.granted).toBe(true)
      if (entered.granted) await entered.release()
      clock.advance(Math.floor(spec.honest.perMs / spec.honest.uses))
    }
    expect(await heldUnits(ledger)).toBe(0)
  })

  it("LIM-4 other accounts can only refuse someone at service level", async () => {
    const { clock, ledger } = leaseLedger()
    const shape = spec.shape
    if (shape.kind !== "lease") throw new Error("export.running is a lease")
    for (let i = 0; i < shape.total; i += 1) {
      const entered = await ledger.enter(account(`other-${i}`), clock.now())
      expect(entered.granted).toBe(true)
    }
    const honest = await ledger.enter(account("ada"), clock.now())
    expect(honest.granted).toBe(false)
    if (!honest.granted) expect(honest.reach).toBe("service")
  })

  it("LIM-5 releases once when the job finishes, throws, or is released twice", async () => {
    const { clock, ledger } = leaseLedger()
    const done = await runLimit({
      ledger,
      spec,
      id,
      key: account("ada"),
      clock,
      signal: undefined,
      job: async () => "ok",
    })
    expect(done).toBe("ok")
    expect(await heldUnits(ledger)).toBe(0)

    await expect(
      runLimit({
        ledger,
        spec,
        id,
        key: account("ada"),
        clock,
        signal: undefined,
        job: async () => {
          throw new Error("database went away")
        },
      })
    ).rejects.toThrow("database went away")
    expect(await heldUnits(ledger)).toBe(0)

    const entered = await ledger.enter(account("ada"), clock.now())
    expect(entered.granted).toBe(true)
    if (entered.granted) {
      await entered.release()
      await entered.release()
    }
    expect(await heldUnits(ledger)).toBe(0)
  })

  it("LIM-5 an abort before the grant and an abort while waiting take no slot", async () => {
    const { clock, ledger } = leaseLedger()
    const signal = AbortSignal.abort()
    await expect(
      runLimit({
        ledger,
        spec,
        id,
        key: account("ada"),
        clock,
        signal,
        job: async () => "no",
      })
    ).rejects.toThrow(/abort/i)
    expect(await heldUnits(ledger)).toBe(0)
  })

  it("LIM-5 an abort while the build runs holds the slot until the build ends", async () => {
    const { clock, ledger } = leaseLedger()
    let finish = (_value: string) => {}
    const job = new Promise<string>((resolve) => {
      finish = resolve
    })
    const signal = new AbortController()
    const pending = runLimit({
      ledger,
      spec,
      id,
      key: account("ada"),
      clock,
      signal: signal.signal,
      job: () => job,
    })
    expect(await heldUnits(ledger)).toBe(1)
    signal.abort()
    expect(await heldUnits(ledger)).toBe(1)
    finish("built")
    await pending
    expect(await heldUnits(ledger)).toBe(0)
  })

  it("LIM-5 the hold ending releases the slot once while the build is still going", async () => {
    const { clock, ledger } = leaseLedger()
    const shape = spec.shape
    if (shape.kind !== "lease") throw new Error("export.running is a lease")
    let finish = (_value: string) => {}
    const job = new Promise<string>((resolve) => {
      finish = resolve
    })
    const pending = runLimit({
      ledger,
      spec,
      id,
      key: account("ada"),
      clock,
      signal: undefined,
      job: () => job,
    })
    expect(await heldUnits(ledger)).toBe(1)
    clock.advance(shape.holdMs)
    expect(await heldUnits(ledger)).toBe(0)
    finish("late")
    await pending
    expect(await heldUnits(ledger)).toBe(0)
  })

  it("LIM-6 a refusal names the limit, waits at least one second, and uses the catalog words", async () => {
    const { clock, ledger } = leaseLedger()
    const key = account("ada")
    const first = await ledger.enter(key, clock.now())
    expect(first.granted).toBe(true)
    await expect(
      runLimit({
        ledger,
        spec,
        id,
        key,
        clock,
        signal: undefined,
        job: async () => "second",
      })
    ).rejects.toBeInstanceOf(Limited)
    try {
      await runLimit({
        ledger,
        spec,
        id,
        key,
        clock,
        signal: undefined,
        job: async () => "second",
      })
    } catch (error) {
      expect(error).toBeInstanceOf(Limited)
      const refusal = (error as Limited).refusal
      expect(refusal.limit).toBe(id)
      expect(refusal.reach).toBe("key")
      expect(refusal.retryAfterSeconds).toBeGreaterThanOrEqual(1)
      expect(refusal.retryAfterSeconds).toBe(spec.retryAfterSeconds)
      expect(refusal.message).toBe(spec.says.key)
    }
    if (first.granted) await first.release()
    clock.advance(spec.retryAfterSeconds * 1000)
    const retry = await ledger.enter(key, clock.now())
    expect(retry.granted).toBe(true)
  })

  it("LIM-7 two running exports stay inside the service memory budget", () => {
    const shape = spec.shape
    if (shape.kind !== "lease") throw new Error("export.running is a lease")
    const memory = shape.total * shape.costBytes
    expect(memory).toBeLessThanOrEqual(SERVICE_MEMORY_BYTES)
    expect(limitBounds()).toEqual({
      "export.running": {
        oneKeyShare: spec.accepts.oneKeyShare,
        keysToDenyAll: spec.accepts.keysToDenyAll,
        targetedDenialMs: spec.accepts.targetedDenialMs,
        memoryBytes: memory,
      },
    })
  })
})
