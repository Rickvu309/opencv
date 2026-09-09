// @vitest-environment node
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const webRoot = fileURLToPath(new URL("../..", import.meta.url))

function read(rel: string) {
  return readFileSync(path.join(webRoot, rel), "utf8")
}

describe("Apply seam", () => {
  it("mounts Apply from the feature module, not from shell internals", () => {
    const route = read("src/routes/apply.tsx")

    expect(route).toMatch(/ApplyWorkspace/)
    expect(route).toMatch(/@\/features\/apply\/apply-workspace/)
    expect(route).not.toMatch(/CraftStub/)
    expect(route).not.toMatch(/app-shell-layout/)
    expect(route).not.toMatch(/app-sidebar/)
  })

  it("keeps the Apply workspace free of shell chrome imports", () => {
    const workspace = read("src/features/apply/apply-workspace.tsx")

    expect(workspace).toMatch(/export function ApplyWorkspace/)
    expect(workspace).not.toMatch(/app-shell-layout/)
    expect(workspace).not.toMatch(/app-sidebar/)
    expect(workspace).not.toMatch(/search-modal/)
    expect(workspace).not.toMatch(/@\/router/)
  })

  it("lets the shell swap Apply only through the layout Outlet", () => {
    const layout = read("src/features/app-shell/app-shell-layout.tsx")
    const sidebar = read("src/features/app-shell/app-sidebar.tsx")

    expect(layout).toMatch(/<Outlet/)
    expect(layout).not.toMatch(/ApplyWorkspace/)
    expect(layout).not.toMatch(/apply-workspace/)
    expect(sidebar).toMatch(/id: "apply"/)
    expect(sidebar).toMatch(/badge: true/)
  })

  it("keeps Fit out of the card DTO and every rendered Apply surface", () => {
    const types = read("src/features/apply/apply-types.ts")
    const detail = read("src/features/apply/apply-job-detail.tsx")
    const workspace = read("src/features/apply/apply-workspace.tsx")
    const calendar = read("src/features/apply/apply-calendar.tsx")
    const api = read("src/features/apply/apply-api.ts")

    expect(types).not.toMatch(/fit:/)
    expect(api).not.toMatch(/fit/)
    expect(detail).not.toMatch(/Fit score/)
    expect(detail).not.toMatch(/\/ 100/)
    expect(workspace).not.toMatch(/card\.fit/)
    expect(workspace).not.toMatch(/Fit score/)
    expect(calendar).not.toMatch(/card\.fit/)
  })

  it("labels seeded cards Demo on the board and in the drawer", () => {
    const workspace = read("src/features/apply/apply-workspace.tsx")
    const detail = read("src/features/apply/apply-job-detail.tsx")
    const structure = read("src/features/apply/apply-job-structure.ts")

    expect(structure).toMatch(/export const APPLY_DEMO_LABEL = "Demo"/)
    expect(structure).toMatch(/Starter card so the board isn't empty/)
    expect(workspace).toMatch(/isDemoApplyCard/)
    expect(workspace).toMatch(/APPLY_DEMO_LABEL/)
    expect(detail).toMatch(/isDemoApplyCard/)
    expect(detail).toMatch(/APPLY_DEMO_HINT/)
    expect(detail).not.toMatch(/jobs\.example\.com/)
  })

  it("glances five Stages on a café laptop and defers dead Coming-soon chrome", () => {
    const workspace = read("src/features/apply/apply-workspace.tsx")

    expect(workspace).toMatch(/data-apply-board/)
    expect(workspace).toMatch(/grid-cols-5/)
    expect(workspace).not.toMatch(/w-64 shrink-0/)
    expect(workspace).not.toMatch(/overflow-x-auto/)
    expect(workspace).not.toMatch(/<Filter\b/)
    expect(workspace).not.toMatch(/MoreHorizontal/)
    expect(workspace).not.toMatch(/ComingSoon/)
    expect(workspace).not.toMatch(/comingSoonLabel/)
  })
})
