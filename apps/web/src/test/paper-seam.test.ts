import { readFileSync } from "node:fs"
import path from "node:path"
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { SURFACE_PATHS } from "@/features/app-shell/surfaces.ts"
import { getMockPaperDocs } from "@/test/paper-api-mock.ts"
import { expectPaperDrive } from "@/test/paper-drive.ts"
import { renderApp } from "@/test/render-app.tsx"

const webRoot = path.resolve(__dirname, "../..")

function read(rel: string) {
  return readFileSync(path.join(webRoot, rel), "utf8")
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.unstubAllGlobals()
})

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function savedSummary() {
  const cv = getMockPaperDocs().find((doc) => doc.name === "PM track CV")
  const content = cv?.content as { summary?: string } | undefined
  return content?.summary
}

async function openCv() {
  await expectPaperDrive()
  fireEvent.click(await screen.findByText("PM track CV"))
  const editor = await screen.findByRole("region", {
    name: "Editing PM track CV",
  })
  return within(editor).getByRole("textbox", { name: "Summary" })
}

function typeSummary(summary: HTMLElement, text: string) {
  summary.textContent = text
  fireEvent.input(summary)
}

describe("Paper autosave timing", () => {
  it("saves 700 ms after the last edit and restarts the wait on each edit", async () => {
    renderApp(SURFACE_PATHS.paper)
    const summary = await openCv()
    const before = savedSummary()

    typeSummary(summary, "first burst")
    await sleep(400)
    typeSummary(summary, "first burst, second burst")
    const secondEditAt = performance.now()
    await sleep(400)
    expect(savedSummary()).toBe(before)

    await waitFor(
      () => expect(savedSummary()).toBe("first burst, second burst"),
      { timeout: 3000 }
    )
    expect(performance.now() - secondEditAt).toBeGreaterThanOrEqual(690)
  })

  it("flushes a pending edit when the editor unmounts before the timer", async () => {
    const view = renderApp(SURFACE_PATHS.paper)
    const summary = await openCv()

    typeSummary(summary, "flush me")
    view.unmount()

    await waitFor(() => expect(savedSummary()).toBe("flush me"))
  })
})

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

  it("keeps the documents panel collapsed across a remount", async () => {
    renderApp(SURFACE_PATHS.paper)
    await expectPaperDrive()
    fireEvent.click(await screen.findByText("PM track CV"))
    const editor = await screen.findByRole("region", {
      name: "Editing PM track CV",
    })
    expect(
      screen.getByRole("complementary", { name: "Documents" })
    ).toBeInTheDocument()

    fireEvent.click(
      within(editor.querySelector("header") as HTMLElement).getByRole(
        "button",
        { name: "Documents" }
      )
    )
    expect(localStorage.getItem("opencv:paper:docs-panel")).toBe("collapsed")

    cleanup()
    renderApp(SURFACE_PATHS.paper)
    await expectPaperDrive()
    fireEvent.click(await screen.findByText("PM track CV"))
    await screen.findByRole("region", { name: "Editing PM track CV" })
    expect(
      screen.queryByRole("complementary", { name: "Documents" })
    ).not.toBeInTheDocument()
  })

  it("lets the shell swap Paper only through the layout Outlet", () => {
    const layout = read("src/features/app-shell/app-shell-layout.tsx")

    expect(layout).toMatch(/<Outlet/)
    expect(layout).not.toMatch(/PaperWorkspace/)
    expect(layout).not.toMatch(/paper-workspace/)
    expect(layout).not.toMatch(/CraftStub/)
  })
})
