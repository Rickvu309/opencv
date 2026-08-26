// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const webRoot = fileURLToPath(new URL("../..", import.meta.url))
const repoRoot = path.resolve(webRoot, "../..")
const uiRoot = path.join(repoRoot, "packages/ui")
const componentsDir = path.join(uiRoot, "src/components")

function read(rel: string) {
  return readFileSync(path.join(repoRoot, rel), "utf8")
}

function readJson(rel: string) {
  return JSON.parse(read(rel))
}

function primitiveFiles() {
  return readdirSync(componentsDir).filter(
    (name) => name.endsWith(".tsx") && !name.endsWith(".stories.tsx")
  )
}

describe("Storybook catalog", () => {
  it("runs from a monorepo script and builds static output", () => {
    const root = readJson("package.json")
    const ui = readJson("packages/ui/package.json")

    expect(root.scripts.storybook).toBe("pnpm --filter @workspace/ui storybook")
    expect(root.scripts["build-storybook"]).toBe(
      "pnpm --filter @workspace/ui build-storybook"
    )
    expect(ui.scripts.storybook).toMatch(/storybook dev/)
    expect(ui.scripts["build-storybook"]).toMatch(/storybook build/)

    const ci = read(".github/workflows/ci.yml")
    expect(ci).toMatch(/build-storybook/)
  })

  it("gives every absorbed primitive a colocated story that imports the source file", () => {
    const primitives = primitiveFiles()
    expect(primitives.length).toBeGreaterThan(0)

    for (const file of primitives) {
      const story = file.replace(/\.tsx$/, ".stories.tsx")
      const storyPath = path.join(componentsDir, story)
      expect(existsSync(storyPath), `missing ${story}`).toBe(true)

      const source = readFileSync(storyPath, "utf8")
      const specifier = `./${file.replace(/\.tsx$/, "")}`
      expect(source).toMatch(
        new RegExp(`from ["']${specifier.replace(".", "\\.")}["']`)
      )
      expect(source).toMatch(/<|component:/)
    }
  })

  it("shares the UI package global CSS and applies the monorepo Autodocs fix", () => {
    const preview = read("packages/ui/.storybook/preview.ts")
    const main = read("packages/ui/.storybook/main.ts")

    expect(preview).toMatch(/src\/styles\/globals\.css/)
    expect(main).toMatch(/reactDocgen:\s*["']react-docgen["']/)
    expect(main).toMatch(/check:\s*false/)
    expect(main).toMatch(/@storybook\/react-vite/)
    expect(main).toMatch(/@storybook\/addon-a11y/)
    expect(preview).toMatch(/a11y:/)
    expect(preview).not.toMatch(/dark:\s*\{\s*name:\s*["']dark["']/)
  })

  it("documents Foundations token pages", () => {
    const foundations = path.join(uiRoot, "src/foundations")
    for (const page of ["color", "type", "radius", "motion", "icons"]) {
      expect(
        existsSync(path.join(foundations, `${page}.stories.tsx`)),
        `missing foundations/${page}.stories.tsx`
      ).toBe(true)
    }
  })
})

describe("kit classes survive the Storybook production build", () => {
  const staticDir = path.join(uiRoot, "storybook-static")

  function listCss(dir: string, acc: string[] = []) {
    if (!existsSync(dir)) return acc
    for (const name of readdirSync(dir)) {
      const next = path.join(dir, name)
      if (statSync(next).isDirectory()) listCss(next, acc)
      else if (name.endsWith(".css")) acc.push(next)
    }
    return acc
  }

  const cssFiles = listCss(staticDir)

  it.skipIf(cssFiles.length === 0)(
    "emits bg-primary from the absorbed kit button",
    () => {
      const css = cssFiles.map((file) => readFileSync(file, "utf8")).join("\n")
      expect(css).toMatch(/\.bg-primary\b/)
      expect(css).toMatch(/--primary:/)
    }
  )
})

describe("packages/ui/vercel.json", () => {
  it("deploys static Storybook from the UI package, not Railway", () => {
    const config = readJson("packages/ui/vercel.json")

    expect(config.framework).toBe("storybook")
    expect(config.installCommand).toBe("cd ../.. && pnpm install --frozen-lockfile")
    expect(config.buildCommand).toBe("pnpm build-storybook")
    expect(config.outputDirectory).toBe("storybook-static")
  })
})
