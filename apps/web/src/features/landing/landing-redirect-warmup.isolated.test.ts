import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { expect, it, vi } from "vitest"

const chunk = vi.hoisted(() => ({
  gate: Promise.withResolvers<void>(),
  entered: Promise.withResolvers<void>(),
}))

vi.mock("@/routes/apply.tsx", async () => {
  chunk.entered.resolve()
  await chunk.gate.promise
  return { ApplyPage: () => null }
})

it("warms the redirect destination before registering the landing tests", async () => {
  const suite = readFileSync(
    join(dirname(new URL(import.meta.url).pathname), "landing-page.test.tsx"),
    "utf8"
  )
  const imports = [...suite.matchAll(/import "(@\/test\/warm-routes\.ts)"/g)]
  const warming = Promise.all(
    imports.map(() => import("@/test/warm-routes.ts"))
  )
  try {
    expect(
      await Promise.race([
        chunk.entered.promise.then(() => "chunk requested"),
        warming.then(() => "warmup finished"),
      ])
    ).toBe("chunk requested")
    let finished = false
    void warming.then(() => {
      finished = true
    })
    await Promise.resolve()
    expect(finished).toBe(false)
  } finally {
    chunk.gate.resolve()
    await warming
  }
})
