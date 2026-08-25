// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const webRoot = fileURLToPath(new URL("../..", import.meta.url))
const repoRoot = path.resolve(webRoot, "../..")

function read(rel: string) {
  return readFileSync(path.join(webRoot, rel), "utf8")
}

function pitchSources() {
  const dir = path.join(webRoot, "src/features/pitch")
  return readdirSync(dir)
    .filter((name) => /\.(ts|tsx)$/.test(name) && !name.includes(".test."))
    .map((name) => ({
      name,
      source: readFileSync(path.join(dir, name), "utf8"),
    }))
}

describe("Pitch surface seam", () => {
  it("mounts Pitch from the feature module, not from shell internals", () => {
    const route = read("src/routes/pitch.tsx")

    expect(route).toMatch(/PitchWorkspace/)
    expect(route).toMatch(/@\/features\/pitch\/pitch-workspace/)
    expect(route).not.toMatch(/CraftStub/)
    expect(route).not.toMatch(/app-shell-layout/)
    expect(route).not.toMatch(/app-sidebar/)
  })

  it("keeps the Pitch workspace free of shell chrome imports", () => {
    const workspace = read("src/features/pitch/pitch-workspace.tsx")

    expect(workspace).toMatch(/export function PitchWorkspace/)
    expect(workspace).not.toMatch(/app-shell-layout/)
    expect(workspace).not.toMatch(/app-sidebar/)
    expect(workspace).not.toMatch(/search-modal/)
    expect(workspace).not.toMatch(/@\/router/)
  })

  it("lets the shell swap Pitch only through the layout Outlet", () => {
    const layout = read("src/features/app-shell/app-shell-layout.tsx")

    expect(layout).toMatch(/<Outlet/)
    expect(layout).not.toMatch(/PitchWorkspace/)
    expect(layout).not.toMatch(/pitch-workspace/)
    expect(layout).not.toMatch(/CraftStub/)
  })
})

describe("Pitch mock GitHub boundary", () => {
  it("does not include the live GitHub API client", () => {
    expect(
      existsSync(path.join(webRoot, "src/features/pitch/pitch-github-api.ts"))
    ).toBe(false)
    expect(
      existsSync(
        path.join(repoRoot, "apps/web/src/prototype/app-shell/pitch-github-api.ts")
      )
    ).toBe(false)
  })

  it("never calls GitHub or third-party contribution APIs", () => {
    const forbidden = [
      /api\.github\.com/,
      /jogruber\.de/,
      /github-contributions-api/,
      /fetch\s*\(/,
    ]

    for (const file of pitchSources()) {
      for (const pattern of forbidden) {
        expect(file.source, `${file.name} matches ${pattern}`).not.toMatch(
          pattern
        )
      }
    }

    expect(read("src/routes/pitch.tsx")).not.toMatch(/pitch-github-api/)
  })

  it("seeds the placeholder User, not the demo persona", () => {
    const types = read("src/features/pitch/pitch-types.ts")
    const mock = read("src/features/pitch/pitch-github-mock.ts")

    expect(types).toMatch(/getDevProfile/)
    expect(types).not.toMatch(/Eric Nguyen/)
    expect(types).not.toMatch(/eric-nguyen/)
    expect(mock).not.toMatch(/Eric Nguyen/)
    expect(mock).not.toMatch(/eric-nguyen/)
  })
})
