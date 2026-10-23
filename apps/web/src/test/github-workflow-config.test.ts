// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const repoRoot = path.resolve(fileURLToPath(new URL("../../../..", import.meta.url)))
const workflowsDir = path.join(repoRoot, ".github/workflows")

const read = (relative: string) =>
  readFileSync(path.join(repoRoot, relative), "utf8")

describe("ci.yml", () => {
  const ci = read(".github/workflows/ci.yml")

  it("names the job `ci` so the required check context is stable", () => {
    expect(ci).toMatch(/^jobs:\n {2}ci:\n {4}name: ci$/m)
  })

  it("declares read-only permissions and a concurrency group", () => {
    expect(ci).toMatch(/^permissions:\n {2}contents: read$/m)
    expect(ci).toMatch(/^concurrency:\n {2}group: .+\n {2}cancel-in-progress: .+$/m)
  })
})

describe("workflow actions", () => {
  it("pins every `uses:` to a 40 character SHA", () => {
    const uses = readdirSync(workflowsDir)
      .filter((file) => /\.ya?ml$/.test(file))
      .flatMap(
        (file) =>
          read(`.github/workflows/${file}`).match(/^\s*(?:- )?uses: .+$/gm) ?? []
      )

    expect(uses.length).toBeGreaterThan(0)
    for (const line of uses) {
      expect(line).toMatch(/uses: \S+@[0-9a-f]{40}(\s+#.*)?$/)
    }
  })
})

describe("pr-title.yml", () => {
  const titlePattern = () => {
    const source = read(".github/workflows/pr-title.yml").match(
      /PATTERN='([^']+)'/
    )?.[1]
    if (!source) throw new Error("pr-title.yml defines no PATTERN")
    return new RegExp(source)
  }

  it("accepts conventional and ticket titles and rejects the rest", () => {
    const pattern = titlePattern()
    for (const title of ["QVE-12: add x", "deps: bump y", "fix: z"]) {
      expect(pattern.test(title), title).toBe(true)
    }
    for (const title of ["update stuff", "QVE-12:", "feat: x"]) {
      expect(pattern.test(title), title).toBe(false)
    }
  })
})
