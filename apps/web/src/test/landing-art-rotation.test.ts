// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const TRANSLATE_THEN_NEGATIVE_ROTATE_CORNER_FORM =
  /^translate\((-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)\) rotate\((-?\d+(?:\.\d+)?)\)$/

const landingDir = fileURLToPath(
  new URL("../features/landing", import.meta.url)
)

function artFiles(): string[] {
  return ["figures", "blog"].flatMap((dir) => {
    const full = path.join(landingDir, dir)
    return readdirSync(full)
      .filter((name) => name.endsWith("-art.tsx"))
      .sort()
      .map((name) => path.join(full, name))
  })
}

function numToken(body: string, name: string): string | null {
  const match = body.match(new RegExp(`\\b${name}=\\{(-?\\d+(?:\\.\\d+)?)\\}`))
  return match?.[1] ?? null
}

function ellipses(source: string): Array<{
  transform: string | null
  cx: string | null
  cy: string | null
  rx: string | null
  ry: string | null
}> {
  return [...source.matchAll(/<ellipse\b([\s\S]*?)\/>/g)].map((match) => {
    const body = match[1]
    return {
      transform: body.match(/\btransform="([^"]*)"/)?.[1] ?? null,
      cx: numToken(body, "cx"),
      cy: numToken(body, "cy"),
      rx: numToken(body, "rx"),
      ry: numToken(body, "ry"),
    }
  })
}

function centreRotate(transform: string): boolean {
  for (const match of transform.matchAll(/rotate\(([^)]*)\)/g)) {
    const args = match[1]
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
    if (args.length >= 2) return true
  }
  return false
}

describe("landing art rotates ellipses around the corner", () => {
  it("rotates every ellipse around the node's corner", () => {
    const files = artFiles()
    const rels = files.map((file) =>
      path.relative(landingDir, file).replaceAll("\\", "/")
    )
    expect(rels).toEqual(
      expect.arrayContaining([
        "blog/b2b-cover-art.tsx",
        "figures/applications-art.tsx",
        "figures/coach-art.tsx",
        "figures/cv-art.tsx",
      ])
    )

    const problems: string[] = []
    let rotated = 0
    for (const file of files) {
      const text = readFileSync(file, "utf8")
      const rel = path.relative(landingDir, file).replaceAll("\\", "/")
      for (const [index, ellipse] of ellipses(text).entries()) {
        const transform = ellipse.transform ?? ""
        const where = `${rel} ellipse ${index + 1}`
        if (centreRotate(transform)) {
          problems.push(`${where} uses a centre rotate: ${transform}`)
        }
        if (!transform.includes("rotate(")) continue
        rotated += 1
        if (!TRANSLATE_THEN_NEGATIVE_ROTATE_CORNER_FORM.test(transform)) {
          problems.push(
            `${where} is not translate(x y) rotate(-r): ${transform || "no transform"}`
          )
        }
        if (
          ellipse.cx === null ||
          ellipse.cx !== ellipse.rx ||
          ellipse.cy !== ellipse.ry
        ) {
          problems.push(
            `${where} is not centred in its own box (cx ${ellipse.cx} rx ${ellipse.rx}, cy ${ellipse.cy} ry ${ellipse.ry})`
          )
        }
      }
    }
    expect(rotated).toBeGreaterThan(0)
    expect(problems, problems.join("\n")).toEqual([])
  })
})
