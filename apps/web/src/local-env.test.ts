import { readFileSync } from "node:fs"
import path from "node:path"
import { createElement } from "react"
import { upgradeStoredPaper } from "@workspace/domain"
import { cleanup, screen, within } from "@testing-library/react"
import { afterEach, beforeAll, expect, it, vi } from "vitest"

import { SAMPLE_AUTHOR_NAME } from "@/features/seed/sample-author.ts"
import { installEditorPolyfills } from "@/test/paper-engine-kit.tsx"
import { seededCvClient } from "@/test/paper-fixture.ts"
import { applyLocalApiUrl } from "../local-env"
import { defaultCvData } from "./features/paper/cv-templates/cv-types.ts"
import { PaperCvEditor } from "./features/paper/paper-cv-editor.tsx"
import {
  pages,
  record,
  render,
} from "./features/paper/paper-editor.fixtures.tsx"

const loadEnv = vi.hoisted(() => vi.fn())
const cvClient = vi.hoisted(() => ({
  client: null as ReturnType<typeof seededCvClient> | null,
}))

vi.mock("vite", () => ({ loadEnv }))

vi.mock("@/lib/paper-sync.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paper-sync.ts")>()),
  usePaperSync: () => ({
    sync: null,
    status: "saved" as const,
    generation: 1,
    client: cvClient.client,
  }),
}))

beforeAll(() => {
  installEditorPolyfills()
})

const savedApiUrl = process.env.VITE_API_URL

afterEach(() => {
  cleanup()
  loadEnv.mockReset()
  if (savedApiUrl === undefined) delete process.env.VITE_API_URL
  else process.env.VITE_API_URL = savedApiUrl
})

it("reads the repo-root .env that ocv-tools take writes, and an explicit VITE_API_URL wins over the url derived from PORT so a Railway build stays unchanged", () => {
  loadEnv.mockReturnValue({
    PORT: "4000",
    VITE_API_URL: "https://api.example.test",
  })
  const urls = applyLocalApiUrl("development")
  expect(loadEnv).toHaveBeenCalledWith(
    "development",
    path.resolve(__dirname, "../../.."),
    ""
  )
  expect(
    readFileSync(
      path.resolve(__dirname, "../../../scripts/ocv-tools/worktree.mjs"),
      "utf8"
    )
  ).toContain('join(worktree, ".env")')
  expect(urls.apiUrl).toBe("http://localhost:4000")
  expect(process.env.VITE_API_URL).toBe("https://api.example.test")
})

it("derives VITE_API_URL from PORT when none is set", () => {
  loadEnv.mockReturnValue({ PORT: "4000" })
  applyLocalApiUrl("development")
  expect(process.env.VITE_API_URL).toBe("http://localhost:4000")
})

it("opens the CV on a width-fit sheet with Name and Summary and no Coach float", async () => {
  const upgraded = upgradeStoredPaper("cv", defaultCvData())
  if (!upgraded.ok) throw new Error(upgraded.message)
  cvClient.client = seededCvClient(upgraded.document)
  render(
    createElement(PaperCvEditor, {
      initial: record,
      pages: pages(1),
      onBack: () => undefined,
    })
  )
  const editor = await screen.findByRole("region", {
    name: "Editing PM track CV",
  })
  const view = within(editor)
  expect(view.getByRole("textbox", { name: "Document name" })).toHaveValue(
    "PM track CV"
  )
  expect(view.getByRole("textbox", { name: "Full name" })).toHaveValue(
    SAMPLE_AUTHOR_NAME
  )
  expect(
    view.getByText(/Year-4 Information Systems student/)
  ).toBeInTheDocument()
  expect(view.getByRole("button", { name: "Coach" })).toBeInTheDocument()
  expect(editor.querySelector('[data-paper-a4-fit="width"]')).not.toBeNull()
  expect(document.querySelector("[data-coach-float-pill]")).toBeNull()
})
