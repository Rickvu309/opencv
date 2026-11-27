import { afterEach, describe, expect, it } from "vitest"

import { claimTabWriter } from "./paper-sync-ports.ts"

type Grant = (lock: object | null) => Promise<void> | null

function fakeLocks() {
  const held = new Set<string>()
  return {
    request(name: string, _options: object, grant: Grant) {
      if (held.has(name)) return Promise.resolve(grant(null))
      held.add(name)
      const kept = grant({ name })
      return Promise.resolve(kept).then(() => {
        held.delete(name)
      })
    },
  }
}

const original = Object.getOwnPropertyDescriptor(navigator, "locks")

afterEach(() => {
  if (original) Object.defineProperty(navigator, "locks", original)
  else Reflect.deleteProperty(navigator, "locks")
  sessionStorage.clear()
})

describe("which writer a tab uses for a Paper", () => {
  it("gives a second open in the same page the writer the first one releases", async () => {
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: fakeLocks(),
    })
    const docId = "00000000-0000-4000-8000-000000000003"
    const first = await claimTabWriter(docId, [])
    const second = claimTabWriter(docId, [first.writer])
    first.release()
    expect((await second).writer).toBe(first.writer)
    second.then((claim) => claim.release())
  })

  it("adopts a stored writer no other tab holds", async () => {
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: fakeLocks(),
    })
    const docId = "00000000-0000-4000-8000-000000000004"
    const claim = await claimTabWriter(docId, ["tab-closed"])
    expect(claim.writer).toBe("tab-closed")
    const other = await claimTabWriter(
      "00000000-0000-4000-8000-000000000005",
      []
    )
    expect(other.writer).not.toBe("tab-closed")
    claim.release()
    other.release()
  })
})
