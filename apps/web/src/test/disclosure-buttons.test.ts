// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"
import { describe, expect, it } from "vitest"

const srcDir = fileURLToPath(new URL("..", import.meta.url))

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return /\.tsx$/.test(entry.name) && !/\.test\.tsx$/.test(entry.name)
      ? [full]
      : []
  })
}

type Gap = { line: number; problem: string }

function attributeNames(node: ts.JsxOpeningLikeElement) {
  return new Set(
    node.attributes.properties.flatMap((property) =>
      ts.isJsxAttribute(property) ? [property.name.getText()] : []
    )
  )
}

function roleOf(node: ts.JsxOpeningLikeElement) {
  for (const property of node.attributes.properties) {
    if (ts.isJsxAttribute(property) && property.name.getText() === "role")
      return property.initializer?.getText().replace(/["{}]/g, "")
  }
  return undefined
}

function disclosureGaps(source: string, dockFile: boolean): Gap[] {
  const file = ts.createSourceFile(
    "x.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
  const gaps: Gap[] = []
  function visit(node: ts.Node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const names = attributeNames(node)
      const line = file.getLineAndCharacterOfPosition(node.getStart()).line + 1
      const role = roleOf(node)
      const isCombobox =
        role === "tab" ||
        role === "combobox" ||
        names.has("aria-activedescendant")
      if (
        names.has("aria-controls") &&
        !names.has("aria-expanded") &&
        !isCombobox
      )
        gaps.push({
          line,
          problem: "aria-controls without aria-expanded",
        })
      const dockToggle = [...names].some((name) =>
        name.startsWith("data-dock-")
      )
      if (
        dockFile &&
        dockToggle &&
        !(names.has("aria-expanded") && names.has("aria-controls"))
      )
        gaps.push({
          line,
          problem:
            "a dock button that opens a panel needs aria-expanded and aria-controls",
        })
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return gaps
}

describe("buttons that open a panel say so", () => {
  it("flags a controlling button that hides its state", () => {
    expect(
      disclosureGaps(
        `const a = <Button aria-controls="p" onClick={toggle}>Open</Button>`,
        false
      )
    ).toEqual([{ line: 1, problem: "aria-controls without aria-expanded" }])
    expect(
      disclosureGaps(
        `const a = <Button aria-controls="p" aria-expanded={open}>Open</Button>`,
        false
      )
    ).toEqual([])
  })

  it("flags a dock button with no expanded state, as the Coach button had", () => {
    const old = `const a = <Button type="button" data-dock-coach="" onClick={onCoach}>Coach</Button>`
    expect(disclosureGaps(old, true)).toHaveLength(1)
  })

  it("holds across the web app", () => {
    const hits = sourceFiles(srcDir).flatMap((file) =>
      disclosureGaps(
        readFileSync(file, "utf8"),
        file.includes(`${path.sep}features${path.sep}app-shell${path.sep}`)
      ).map(
        (gap) => `${path.relative(srcDir, file)}:${gap.line} ${gap.problem}`
      )
    )
    expect(
      hits,
      "Set aria-expanded with the open state, and aria-controls with the id of the panel, on the button that opens it."
    ).toEqual([])
  })
})
