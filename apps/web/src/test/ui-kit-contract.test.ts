// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs"
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

  it("ships the stock shadcn variables and the four motion tokens", () => {
    const css = read("packages/ui/src/styles/globals.css")
    const stock = [
      "background",
      "foreground",
      "card",
      "card-foreground",
      "popover",
      "popover-foreground",
      "primary",
      "primary-foreground",
      "secondary",
      "secondary-foreground",
      "muted",
      "muted-foreground",
      "accent",
      "accent-foreground",
      "destructive",
      "border",
      "input",
      "ring",
      "chart-1",
      "chart-2",
      "chart-3",
      "chart-4",
      "chart-5",
      "radius",
      "sidebar",
      "sidebar-foreground",
      "sidebar-primary",
      "sidebar-primary-foreground",
      "sidebar-accent",
      "sidebar-accent-foreground",
      "sidebar-border",
      "sidebar-ring",
    ]
    const root = /^:root \{\n([\s\S]*?)^\}/m.exec(css)?.[1] ?? ""
    const names = [...root.matchAll(/^\s*--([\w-]+):/gm)].map((m) => m[1])
    expect(names.sort()).toEqual([...stock].sort())

    // Release-one ADR-0006. Stock names, the design's values.
    for (const value of [
      '--font-sans: "Inter Variable", "Inter", ui-sans-serif, system-ui, sans-serif;',
      "--background: oklch(0.982 0.001 286.376);",
      "--foreground: oklch(0.218 0 0);",
      "--ring: oklch(0.607 0.141 276.281);",
      "--chart-1: oklch(0.649 0.186 267.396);",
      "--chart-2: oklch(0.65 0.13 154.934);",
      "--chart-3: oklch(0.567 0.159 275.206);",
      "--chart-4: oklch(0.758 0.156 81.298);",
      "--chart-5: oklch(0.706 0.003 286.326);",
      "--destructive: oklch(0.572 0.183 23.679);",
      "@utility glow",
    ]) {
      expect(css, value).toContain(value)
    }
    expect(css).not.toMatch(/@utility glow[\s\S]*#[0-9A-Fa-f]{3,8}/)

    for (const token of [
      "--duration-micro: 150ms",
      "--ease-micro: cubic-bezier(0.22, 1, 0.36, 1)",
      "--duration-panel: 280ms",
      "--ease-panel: cubic-bezier(0.32, 0.72, 0, 1)",
      "prefers-reduced-motion",
    ]) {
      expect(css, token).toContain(token)
    }
    for (const retired of [
      /--text-/,
      /--(?:info|success|warning)\b/,
      /--duration-(?:base|fast|slow)/,
      /--ease-(?:standard|emphasized)/,
      /--z-index-/,
      /--shadow-/,
      /ui-serif/,
    ]) {
      expect(css, String(retired)).not.toMatch(retired)
    }
  })

  it("removes the hand-rolled kit pieces the stock kit replaced", () => {
    const dir = path.join(repoRoot, "packages/ui/src/components")
    const files = readdirSync(dir)
    expect(files).toContain("empty.tsx")
    expect(files).not.toContain("empty-state.tsx")
    expect(files).not.toContain("text-reveal.tsx")
    expect(files).not.toContain("section.tsx")
    expect(readdirSync(path.join(repoRoot, "packages/ui/src/styles"))).toEqual([
      "globals.css",
    ])
    expect(read("packages/ui/src/lib/utils.ts")).toMatch(
      /export \{ cn \} from "cn"/
    )
  })

  it("keeps Paper / CV / print CSS out of the kit stylesheet", () => {
    const kit = read("packages/ui/src/styles/globals.css")
    const paper = read("apps/web/src/styles/paper.css")
    expect(kit).not.toMatch(/\.paper-editor-canvas/)
    expect(kit).not.toMatch(/\.cv-a4-page/)
    expect(kit).not.toMatch(/\.proof-step-card/)
    expect(paper).toMatch(/--cv-page-height:\s*1123px/)
    expect(paper).toMatch(/\.paper-editor-canvas/)
    expect(paper).toMatch(/\.cv-a4-page/)
    expect(read("apps/web/src/main.tsx")).toMatch(/styles\/paper\.css/)
    expect(read("apps/web/src/main.tsx")).toMatch(/styles\/coach\.css/)
  })

  it("exports the focus ring and media-query hook from the kit", () => {
    expect(read("packages/ui/src/lib/focus-ring.ts")).toMatch(
      /export const FOCUS_RING/
    )
    expect(read("packages/ui/src/hooks/use-media-query.ts")).toMatch(
      /export function useMediaQuery/
    )
    expect(read("apps/web/src/lib/use-media-query.ts")).toMatch(
      /@workspace\/ui\/hooks\/use-media-query/
    )
  })

  it("covers every component file in the kit directory", () => {
    const componentsDir = path.join(repoRoot, "packages/ui/src/components")
    const files = readdirSync(componentsDir, {
      recursive: true,
      encoding: "utf8",
    }).filter((name) => name.endsWith(".tsx"))
    expect(files.length).toBeGreaterThan(0)

    for (const file of files) {
      expect(read(`packages/ui/src/components/${file}`), file).toMatch(
        /data-slot=|slot:\s*["'][a-z-]+["']/
      )
    }
  })
})

describe("web consumes the kit through package exports", () => {
  it("imports the shared stylesheet from the UI package", () => {
    const main = read("apps/web/src/main.tsx")
    expect(main).toMatch(/@workspace\/ui\/globals\.css/)
  })

  it("does not expose a dark-mode d hotkey", () => {
    const provider = read("apps/web/src/components/theme-provider.tsx")
    expect(provider).not.toMatch(/event\.key\.toLowerCase\(\) !== ["']d["']/)
    expect(provider).not.toMatch(/keydown/)
  })

  it("does not import frozen prototype modules", () => {
    const srcDir = path.join(repoRoot, "apps/web/src")
    const files = readdirSync(srcDir, { recursive: true, encoding: "utf8" })
      .filter((file) => /\.tsx?$/.test(file))
      .map((file) => path.join(srcDir, file))

    for (const file of files) {
      expect(readFileSync(file, "utf8")).not.toMatch(/@\/prototype\//)
    }
  })
})
