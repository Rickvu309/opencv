// @vitest-environment node
import { readFileSync, realpathSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { compile } from "tailwindcss"
import { beforeAll, describe, expect, it } from "vitest"

const kitSource = path.dirname(fileURLToPath(import.meta.url))
const stylesDir = path.join(kitSource, "styles")
const kitModules = path.join(kitSource, "../node_modules")

type ExportTarget = string | { style?: string; default?: string } | undefined

function packageSheet(name: string, subpath: string) {
  const dir = realpathSync(path.join(kitModules, name))
  const manifest = JSON.parse(
    readFileSync(path.join(dir, "package.json"), "utf8")
  ) as {
    exports?: Record<string, ExportTarget>
    style?: string
  }
  const target = manifest.exports?.[subpath ? `./${subpath}` : "."]
  const file =
    typeof target === "string"
      ? target
      : (target?.style ?? target?.default ?? manifest.style ?? subpath)
  return path.join(dir, file)
}

function resolveSheet(id: string, base: string) {
  if (id.startsWith(".")) return path.resolve(base, id)
  if (id === "tailwindcss") return packageSheet("tailwindcss", "index.css")
  const parts = id.split("/")
  const nameLength = id.startsWith("@") ? 2 : 1
  return packageSheet(
    parts.slice(0, nameLength).join("/"),
    parts.slice(nameLength).join("/")
  )
}

const UTILITIES = [
  "motion-pop",
  "motion-modal",
  "motion-backdrop",
  "motion-sheet-start",
  "motion-sheet-end",
  "motion-press",
  "motion-press-soft",
  "motion-collapse",
  "motion-appear",
  "motion-rise",
  "motion-send",
  "motion-word",
  "motion-swap",
] as const

const MOVES = new Set([
  "motion-pop",
  "motion-modal",
  "motion-sheet-start",
  "motion-sheet-end",
  "motion-press",
  "motion-press-soft",
  "motion-appear",
  "motion-rise",
  "motion-send",
])

const LAYOUT =
  /\b(?:width|height|margin[\w-]*|padding[\w-]*|top|left|right|bottom|inset[\w-]*|font-size)\b/

let compiler: Awaited<ReturnType<typeof compile>>

function build(candidates: string[]) {
  return compiler.build(candidates)
}

function blocksOf(css: string, selector: string) {
  const out: string[] = []
  let at = css.indexOf(selector)
  while (at >= 0) {
    const open = css.indexOf("{", at)
    let depth = 0
    let end = open
    for (; end < css.length; end++) {
      if (css[end] === "{") depth++
      else if (css[end] === "}" && --depth === 0) break
    }
    out.push(css.slice(open + 1, end))
    at = css.indexOf(selector, end)
  }
  return out.join("\n")
}

function declarations(block: string, property: string) {
  return [
    ...block.matchAll(new RegExp(`(?<![\\w-])${property}:\\s*([^;]+);`, "g")),
  ].map((match) => match[1]!.trim())
}

function reducedBlock(css: string) {
  return blocksOf(css, "@media (prefers-reduced-motion: reduce)")
}

beforeAll(async () => {
  compiler = await compile(
    readFileSync(path.join(stylesDir, "globals.css"), "utf8"),
    {
      base: stylesDir,
      loadStylesheet: async (id, base) => {
        const file = resolveSheet(id, base)
        return {
          path: file,
          base: path.dirname(file),
          content: readFileSync(file, "utf8"),
        }
      },
    }
  )
})

describe("motion tokens", () => {
  it("defines the two timings and the scales once, on the root", () => {
    const css = build(UTILITIES.slice())
    const root = blocksOf(css, ":root, :host")
    expect(declarations(root, "--duration-micro")).toEqual(["150ms"])
    expect(declarations(root, "--ease-micro")).toEqual([
      "cubic-bezier(0.22, 1, 0.36, 1)",
    ])
    expect(declarations(root, "--duration-panel")).toEqual(["280ms"])
    expect(declarations(root, "--ease-panel")).toEqual([
      "cubic-bezier(0.32, 0.72, 0, 1)",
    ])
    expect(declarations(root, "--motion-enter-scale")).toEqual(["0.97"])
    expect(declarations(root, "--motion-press-scale")).toEqual(["0.97"])
    expect(declarations(root, "--motion-press-scale-soft")).toEqual(["0.98"])
  })

  it("gives a bare transition class the project timing and curve", () => {
    const block = blocksOf(build(["transition-colors"]), ".transition-colors")
    expect(declarations(block, "transition-duration")).toEqual([
      "var(--tw-duration, var(--duration-micro))",
    ])
    expect(declarations(block, "transition-timing-function")).toEqual([
      "var(--tw-ease, var(--ease-micro))",
    ])
  })

  it("runs the library enter and exit keyframes on the tokens, not on ease", () => {
    const css = build(["animate-in", "animate-out"])
    for (const name of [".animate-in", ".animate-out"]) {
      const value = declarations(blocksOf(css, name), "animation").join(" ")
      expect(value).toContain("var(--duration-micro)")
      expect(value).toContain("var(--ease-micro)")
      expect(value).not.toMatch(/(?<![\w-])ease(?![\w-])|\.15s/)
    }
  })
})

describe("motion utilities", () => {
  it.each(UTILITIES)(
    "%s runs on a token duration and curve and nothing literal",
    (name) => {
      const block = blocksOf(build([name]), `.${name}`)
      expect(declarations(block, "transition-duration")[0]).toMatch(
        /^var\(--duration-(?:micro|panel)\)$/
      )
      expect(declarations(block, "transition-timing-function")[0]).toMatch(
        /^var\(--ease-(?:micro|panel)\)$/
      )
      for (const duration of declarations(block, "transition-duration"))
        expect(duration).toMatch(/^(?:var\(--duration-(?:micro|panel)\)|0ms)$/)
    }
  )

  it.each(UTILITIES)(
    "%s animates transform and opacity only, the collapse aside",
    (name) => {
      const block = blocksOf(build([name]), `.${name}`)
      const properties = declarations(block, "transition-property").flatMap(
        (list) => list.split(",").map((part) => part.trim())
      )
      expect(properties.length).toBeGreaterThan(0)
      const layout = properties.filter((property) => LAYOUT.test(property))
      expect(layout).toEqual(name === "motion-collapse" ? ["height"] : [])
    }
  )

  it("scales a popup from its trigger and opens a repeat tooltip at once", () => {
    const block = blocksOf(build(["motion-pop"]), ".motion-pop")
    expect(declarations(block, "transform-origin")).toEqual([
      "var(--transform-origin)",
    ])
    expect(block).toMatch(/&\[data-instant\]\s*\{\s*transition-duration: 0ms/)
  })

  it("leaves a sheet faster than it enters", () => {
    for (const name of ["motion-sheet-start", "motion-sheet-end"]) {
      const block = blocksOf(build([name]), `.${name}`)
      expect(declarations(block, "transition-duration")).toEqual([
        "var(--duration-panel)",
        "var(--duration-micro)",
      ])
    }
  })

  it("enters a list item from a start style and leaves it on the same path", () => {
    const block = blocksOf(build(["motion-appear"]), ".motion-appear")
    expect(blocksOf(block, "@starting-style")).toContain(
      "scale: var(--motion-enter-scale)"
    )
    expect(blocksOf(block, "&[data-ending-style]")).toContain("opacity: 0")
  })
})

describe("message entrance", () => {
  it("rises a new chat message a few pixels on the enter token and keeps only the fade when motion is reduced", () => {
    const css = build(["motion-rise"])
    const block = blocksOf(css, ".motion-rise")
    expect(
      declarations(blocksOf(css, ":root, :host"), "--motion-enter-rise")
    ).toEqual(["4px"])
    expect(blocksOf(block, "@starting-style")).toContain(
      "translate: 0 var(--motion-enter-rise)"
    )
    expect(
      blocksOf(
        blocksOf(block, "@media (prefers-reduced-motion: reduce)"),
        "@starting-style"
      )
    ).toContain("translate: 0 0")
  })
})

describe("chat writing", () => {
  it("lifts a sent message further and on the panel timing, keeping only the fade when motion is reduced", () => {
    const css = build(["motion-send"])
    const block = blocksOf(css, ".motion-send")
    expect(
      declarations(blocksOf(css, ":root, :host"), "--motion-send-rise")
    ).toEqual(["12px"])
    expect(declarations(block, "transition-duration")).toEqual([
      "var(--duration-panel)",
    ])
    expect(blocksOf(block, "@starting-style")).toContain(
      "translate: 0 var(--motion-send-rise)"
    )
    expect(
      blocksOf(
        blocksOf(block, "@media (prefers-reduced-motion: reduce)"),
        "@starting-style"
      )
    ).toContain("translate: 0 0")
  })

  it("fades a written word in without moving it", () => {
    const block = blocksOf(build(["motion-word"]), ".motion-word")
    expect(declarations(block, "transition-property")).toEqual(["opacity"])
    expect(blocksOf(block, "@starting-style")).toContain("opacity: 0")
  })

  it("swaps a label through a short blur", () => {
    const block = blocksOf(build(["motion-swap"]), ".motion-swap")
    expect(blocksOf(block, "@starting-style")).toContain("filter: blur(2px)")
    expect(declarations(block, "transition-duration")).toEqual([
      "var(--duration-micro)",
    ])
  })
})

describe("reduced motion", () => {
  it("keeps fades and colour changes and drops movement everywhere", () => {
    const block = reducedBlock(build([]))
    const kept = declarations(block, "transition-property")[0]!
      .replace(/\s*!important/, "")
      .split(",")
      .map((part) => part.trim())
    expect(kept).toContain("opacity")
    expect(kept).toContain("background-color")
    expect(
      kept.filter(
        (property) =>
          /transform|translate|scale|rotate|all/.test(property) ||
          LAYOUT.test(property)
      )
    ).toEqual([])
    expect(declarations(block, "transition-duration")).toEqual([])
  })

  it("lets the library overlays fade without scaling or sliding", () => {
    const block = reducedBlock(build([]))
    expect(block).toContain(
      "animation-duration: var(--duration-micro) !important"
    )
    for (const variable of [
      "--tw-enter-scale: 1",
      "--tw-exit-scale: 1",
      "--tw-enter-translate-x: 0",
      "--tw-enter-translate-y: 0",
      "--tw-exit-translate-x: 0",
      "--tw-exit-translate-y: 0",
    ])
      expect(block).toContain(`${variable} !important`)
  })

  it.each([...MOVES])(
    "%s travels no distance when a person asks for less motion",
    (name) => {
      const block = reducedBlock(blocksOf(build([name]), `.${name}`))
      expect(block).toMatch(/scale: 1|translate: 0 0/)
      expect(block).not.toMatch(/scale: var|translate: -?100%/)
    }
  )
})
