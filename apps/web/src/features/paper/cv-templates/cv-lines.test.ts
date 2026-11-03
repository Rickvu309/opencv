import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const dir = dirname(fileURLToPath(import.meta.url))
const layouts = ["academic", "internship", "photo", "product", "service"]

function layoutSource(name: string) {
  return readFileSync(join(dir, `${name}.tsx`), "utf8")
}

function printsField(
  source: string,
  field: "summary" | "projects" | "languages"
) {
  return source.includes(`data.${field}`)
}

describe("lines the five layouts do not already print", () => {
  it("adds SummaryBlock only where the layout does not print data.summary", () => {
    for (const name of layouts) {
      const source = layoutSource(name)
      expect({
        name,
        summaryBlock: source.includes("SummaryBlock"),
      }).toEqual({
        name,
        summaryBlock: !printsField(source, "summary"),
      })
    }
  })

  it("adds ProjectsBlock only where the layout does not print data.projects", () => {
    for (const name of layouts) {
      const source = layoutSource(name)
      expect({
        name,
        projectsBlock: source.includes("ProjectsBlock"),
      }).toEqual({
        name,
        projectsBlock: !printsField(source, "projects"),
      })
    }
  })

  it("prints languages on every layout, because none of the five printed that field", () => {
    for (const name of layouts) {
      const source = layoutSource(name)
      expect({
        name,
        languagesBlock: source.includes("LanguagesBlock"),
        printedItself: printsField(source, "languages"),
      }).toEqual({
        name,
        languagesBlock: true,
        printedItself: false,
      })
    }
  })
})
