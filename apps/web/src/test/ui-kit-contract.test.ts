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

  it("ships ADR-0010 tokens for type, status, chart, pitch, motion, shadow, and z-index", () => {
    const css = read("packages/ui/src/styles/globals.css")
    const tokens = [
      "--font-heading:",
      "--text-micro:",
      "--text-page-title:",
      "--text-section-title:",
      "--text-body:",
      "--text-label:",
      "--success:",
      "--success-foreground:",
      "--warning:",
      "--warning-foreground:",
      "--info:",
      "--info-foreground:",
      "--pitch-tone-warm:",
      "--pitch-tone-cool:",
      "--pitch-tone-neutral:",
      "--pitch-tone-emerald:",
      "--pitch-tone-dark:",
      "--duration-fast:",
      "--duration-base:",
      "--duration-slow:",
      "--ease-standard:",
      "--shadow-sm:",
      "--z-index-dropdown:",
      "--z-index-modal:",
      "prefers-reduced-motion",
    ]
    for (const token of tokens) {
      expect(css, token).toContain(token)
    }
    expect(css).toMatch(/ui-serif,\s*Georgia/)
    expect(css).not.toMatch(/--sidebar-primary:\s*oklch\(0\.488 0\.243 264/)
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
  })

  it("exports the focus ring and media-query hook from the kit", () => {
    expect(read("packages/ui/src/lib/focus-ring.ts")).toMatch(
      /export const FOCUS_RING/
    )
    expect(read("packages/ui/src/hooks/use-media-query.ts")).toMatch(
      /export function useMediaQuery/
    )
    expect(read("apps/web/src/features/app-shell/focus-ring.ts")).toMatch(
      /@workspace\/ui\/lib\/focus-ring/
    )
    expect(read("apps/web/src/features/app-shell/use-media-query.ts")).toMatch(
      /@workspace\/ui\/hooks\/use-media-query/
    )
  })

  it("covers every component file in the kit directory", () => {
    const componentsDir = path.join(repoRoot, "packages/ui/src/components")
    const files = readdirSync(componentsDir).filter(
      (name) => name.endsWith(".tsx") && !name.endsWith(".stories.tsx")
    )
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
