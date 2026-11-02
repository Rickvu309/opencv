import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const dir = path.dirname(new URL(import.meta.url).pathname)
const read = (file: string) => readFileSync(path.join(dir, file), "utf8")

const importsOf = (source: string) =>
  [...source.matchAll(/import\("([^"]+)"\)/g)].map((match) => match[1])

describe("renderApp loads the signed-in routes before a test starts", () => {
  it("imports warm-routes.ts", () => {
    expect(read("render-app.tsx")).toMatch(/import "@\/test\/warm-routes\.ts"/)
  })

  it("warms every lazy route module that the router names, except marketing pages", () => {
    const routed = importsOf(read("../router.tsx")).filter(
      (specifier) => !/landing/.test(specifier)
    )
    const warmed = importsOf(read("warm-routes.ts"))
    expect(routed.length).toBeGreaterThan(0)
    expect(
      routed.filter((specifier) => !warmed.includes(specifier)),
      "A first test that mounts the app pays for these imports against the 5s findBy limit and times out on a busy machine. Add them to apps/web/src/test/warm-routes.ts."
    ).toEqual([])
  })
})
