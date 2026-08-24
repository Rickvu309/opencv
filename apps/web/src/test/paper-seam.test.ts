// @vitest-environment node
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const webRoot = fileURLToPath(new URL("../..", import.meta.url))

function read(rel: string) {
  return readFileSync(path.join(webRoot, rel), "utf8")
}

describe("Spec 4 Paper seam", () => {
  it("mounts Paper from the feature module, not from shell internals", () => {
    const route = read("src/routes/paper.tsx")

    expect(route).toMatch(/PaperWorkspace/)
    expect(route).toMatch(/@\/features\/paper\/paper-workspace/)
    expect(route).not.toMatch(/CraftStub/)
    expect(route).not.toMatch(/app-shell-layout/)
    expect(route).not.toMatch(/app-sidebar/)
  })

  it("keeps the Paper workspace free of shell chrome imports", () => {
    const workspace = read("src/features/paper/paper-workspace.tsx")

    expect(workspace).toMatch(/export function PaperWorkspace/)
    expect(workspace).not.toMatch(/app-shell-layout/)
    expect(workspace).not.toMatch(/app-sidebar/)
    expect(workspace).not.toMatch(/search-modal/)
    expect(workspace).not.toMatch(/@\/router/)
  })

  it("lets the shell swap Paper only through the layout Outlet", () => {
    const layout = read("src/features/app-shell/app-shell-layout.tsx")

    expect(layout).toMatch(/<Outlet/)
    expect(layout).not.toMatch(/PaperWorkspace/)
    expect(layout).not.toMatch(/paper-workspace/)
    expect(layout).not.toMatch(/CraftStub/)
  })
})
