import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { findColdAppRenders, rendererWarmsRoutes } from "./route-warmup-scan.ts"

const dir = path.dirname(new URL(import.meta.url).pathname)
const read = (file: string) => readFileSync(path.join(dir, file), "utf8")

const srcDir = path.join(dir, "..")

const LAZY_ROUTE_RENDERER_USERS = [
  "test/render-app.tsx",
  "router-lazy.isolated.test.tsx",
]

function sourceFiles(folder: string): { name: string; text: string }[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(folder, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    if (!/\.tsx?$/.test(entry.name) || entry.name === "warm-routes.test.ts") {
      return []
    }
    return [
      { name: path.relative(srcDir, full), text: readFileSync(full, "utf8") },
    ]
  })
}

const importsOf = (source: string) =>
  [...source.matchAll(/import\("([^"]+)"\)/g)].map((match) => match[1])

describe("renderApp loads the signed-in routes before a test starts", () => {
  it("the favorites test imports warm-routes.ts", () => {
    expect(read("../features/app-shell/app-shell.isolated.test.tsx")).toMatch(
      /import "@\/test\/warm-routes\.ts"/
    )
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

  it("loads every route in renderApp before the first test, so a slow machine cannot spend the 5s findBy limit on imports", () => {
    expect(rendererWarmsRoutes(read("render-app.tsx"))).toBe(true)
  })

  it("flags a renderApp that leaves route imports to the first test", () => {
    expect(
      rendererWarmsRoutes(
        'export { renderApp } from "./render-app-lazy-routes.tsx"\n'
      )
    ).toBe(false)
    expect(
      rendererWarmsRoutes(
        'import "./warm-routes.ts"\n\nexport { renderApp } from "./render-app-lazy-routes.tsx"\n'
      )
    ).toBe(true)
  })

  it("keeps the cold renderer for the test that proves routes load lazily", () => {
    expect(
      findColdAppRenders(sourceFiles(srcDir), LAZY_ROUTE_RENDERER_USERS)
    ).toEqual([])
  })

  it("flags a test that mounts the app with the cold renderer", () => {
    const files = [
      {
        name: "features/apply/apply-board.test.tsx",
        text: 'import { renderApp } from "@/test/render-app-lazy-routes.tsx"',
      },
      {
        name: "features/apply/apply-list.test.tsx",
        text: 'import { renderApp } from "@/test/render-app.tsx"',
      },
    ]
    expect(findColdAppRenders(files, LAZY_ROUTE_RENDERER_USERS)).toEqual([
      "features/apply/apply-board.test.tsx",
    ])
  })
})
