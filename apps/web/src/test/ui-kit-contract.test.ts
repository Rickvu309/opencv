// @vitest-environment node
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const webRoot = fileURLToPath(new URL("../..", import.meta.url))
const repoRoot = path.resolve(webRoot, "../..")

function read(rel: string) {
  return readFileSync(path.join(repoRoot, rel), "utf8")
}

function readJson(rel: string) {
  return JSON.parse(read(rel))
}

describe("shadcn monorepo CLI contract", () => {
  const appConfig = readJson("apps/web/components.json")
  const uiConfig = readJson("packages/ui/components.json")

  it("aligns style, baseColor, and iconLibrary across CLI workspaces", () => {
    expect(appConfig.style).toBe(uiConfig.style)
    expect(appConfig.iconLibrary).toBe(uiConfig.iconLibrary)
    expect(appConfig.tailwind.baseColor).toBe(uiConfig.tailwind.baseColor)
    expect(appConfig.style).toBeTruthy()
    expect(appConfig.tailwind.baseColor).toBeTruthy()
    expect(appConfig.iconLibrary).toBeTruthy()
  })

  it("leaves tailwind.config empty for Tailwind v4", () => {
    expect(appConfig.tailwind.config).toBe("")
    expect(uiConfig.tailwind.config).toBe("")
  })
})

describe("UI package kit surface", () => {
  it("exposes components and global CSS through package exports", () => {
    const pkg = readJson("packages/ui/package.json")
    expect(pkg.private).toBe(true)
    expect(pkg.exports["./globals.css"]).toBe("./src/styles/globals.css")
    expect(pkg.exports["./components/*"]).toBe("./src/components/*.tsx")
    expect(pkg.exports["./lib/*"]).toBe("./src/lib/*.ts")
    expect(pkg.exports["./hooks/*"]).toBe("./src/hooks/*.ts")
  })

  it("owns theme tokens as CSS variables in the package stylesheet", () => {
    const css = read("packages/ui/src/styles/globals.css")
    expect(css).toMatch(/@import\s+["']tailwindcss["']/)
    expect(css).toMatch(/:root\s*\{/)
    expect(css).toMatch(/--background:/)
    expect(css).toMatch(/--primary:/)
    expect(css).toMatch(/@source\s+["'][^"']+\*\.\{ts,tsx\}["']/)
  })

  it("absorbed button and input via the kit path", () => {
    expect(existsSync(path.join(repoRoot, "packages/ui/src/components/button.tsx"))).toBe(
      true
    )
    expect(existsSync(path.join(repoRoot, "packages/ui/src/components/input.tsx"))).toBe(
      true
    )
    expect(read("packages/ui/src/components/button.tsx")).toMatch(
      /bg-primary|data-slot=["']button["']/
    )
    expect(read("packages/ui/src/components/input.tsx")).toMatch(
      /data-slot=["']input["']/
    )
  })
})

describe("web consumes the kit through package exports", () => {
  it("imports the shared stylesheet from the UI package", () => {
    const main = read("apps/web/src/main.tsx")
    expect(main).toMatch(/@workspace\/ui\/globals\.css/)
  })

  it("renders kit button and input on the public shell", () => {
    const home = read("apps/web/src/routes/home.tsx")
    expect(home).toMatch(/from ["']@workspace\/ui\/components\/button["']/)
    expect(home).toMatch(/from ["']@workspace\/ui\/components\/input["']/)
  })
})
