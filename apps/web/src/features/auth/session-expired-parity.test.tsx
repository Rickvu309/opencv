import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, screen, within } from "@testing-library/react"

import { apiFetch } from "@/lib/api.ts"
import { authClient } from "@/lib/auth-client.ts"
import { mockJob } from "@/test/apply-job-fixtures.ts"
import { setMockJobs } from "@/test/apply-jobs-mock.ts"
import { renderApp } from "@/test/render-app.tsx"

import { AUTH_COPY, continueAsLabel } from "./auth-copy.ts"
import boxes from "./design/session-expired.boxes.styles.json"
import snapshot from "./design/session-expired.snapshot.json"
import styles from "./design/session-expired.styles.json"

const css = readFileSync(
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "design/session-expired.pen.css"
  ),
  "utf8"
)
const texts = styles.sections.flatMap((section) => section.texts)
const text = (content: string) => texts.find((t) => t.content === content)!
const box = (id: string) => boxes.boxes.find((b) => b.id === id)!

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

async function expire() {
  vi.stubGlobal("scrollTo", vi.fn())
  setMockJobs([
    mockJob({
      id: "01900000-0000-7000-8000-000000000001",
      title: "Parity job",
      company: "Journey proof",
      stage: "saved",
      position: "a0",
    }),
  ])
  renderApp("/apply/01900000-0000-7000-8000-000000000001")
  await screen.findByRole("navigation", { name: "Breadcrumb" })
  const real = globalThis.fetch
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json(
        {
          ok: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        },
        { status: 401 }
      )
    )
  )
  await apiFetch("/api/profile").catch(() => undefined)
  const dialog = await screen.findByRole("dialog", {
    name: AUTH_COPY.loggedOutTitle,
  })
  vi.stubGlobal("fetch", real)
  return dialog
}

describe("session expired dialog pen parity (DhG87 / mjDga)", () => {
  it("shows the pen's copy, with the signed-out email in the primary row", async () => {
    const dialog = await expire()
    const [title, body, , emailMe, logOut] = texts.map((t) => t.content)
    expect(snapshot.sections).toHaveLength(4)
    expect(within(dialog).getByText(title)).toBeInTheDocument()
    expect(within(dialog).getByText(body)).toBeInTheDocument()
    expect(
      within(dialog).getByRole("button", {
        name: continueAsLabel("you@opencv.me"),
      })
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole("button", { name: emailMe })
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole("button", { name: logOut })
    ).toBeInTheDocument()
    expect(
      dialog.querySelector('[data-slot="session-badge"] svg')
    ).not.toBeNull()
  })

  it("does not draw a Google mark on the email-code action, which sends a code", async () => {
    const dialog = await expire()
    const primary = within(dialog).getByRole("button", { name: /Continue as/ })
    expect(primary.querySelector("img, svg")).toBeNull()
  })

  it("keeps recovery open on Escape and an outside click", async () => {
    const dialog = await expire()
    fireEvent.keyDown(dialog, { key: "Escape" })
    fireEvent.pointerDown(document.body)
    fireEvent.click(document.body)
    expect(
      screen.getByRole("dialog", { name: AUTH_COPY.loggedOutTitle })
    ).toBeInTheDocument()
  })

  it("focuses the primary row first", async () => {
    const dialog = await expire()
    expect(
      within(dialog).getByRole("button", { name: /Continue as/ })
    ).toHaveFocus()
  })

  it("shows the notice and keeps the dialog when the code fails to send", async () => {
    const dialog = await expire()
    vi.mocked(authClient.emailOtp.sendVerificationOtp).mockResolvedValueOnce({
      data: null,
      error: { status: 429, message: "Too many requests" },
    } as never)
    const primary = within(dialog).getByRole("button", { name: /Continue as/ })
    fireEvent.click(primary)
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      AUTH_COPY.sendFailed
    )
    expect(primary).toBeEnabled()
    expect(
      screen.getByRole("dialog", { name: AUTH_COPY.loggedOutTitle })
    ).toBeInTheDocument()
  })

  it("holds the stylesheet to the pen's box and text values", () => {
    const dialog = box("mjDga")
    const badge = box("os1ip")
    const row = box("RIfMH")
    expect(css).toContain(`width: ${dialog.width}px`)
    expect(css).toContain(`gap: ${dialog.gap}px`)
    expect(css).toContain(`padding: ${dialog.padding}px`)
    expect(css).toContain(`border-radius: ${dialog.cornerRadius}px`)
    expect(css).toContain(`top: ${dialog.y}px`)
    expect(css).toContain(`width: ${badge.width}px`)
    expect(css).toContain(`background-color: ${badge.fill!.toLowerCase()}`)
    expect(css).toContain(`min-height: ${row.height}px`)
    expect(css).toContain(`border-radius: ${row.cornerRadius}px`)
    const title = text("You've been logged out")
    expect(css).toContain(`font-size: ${title.fontSize}px`)
    expect(css).toContain(`letter-spacing: ${title.letterSpacing}px`)
    expect(css).toContain(`color: ${title.fill.toLowerCase()}`)
    const body = text("Log in again. Your work is saved.")
    expect(css).toContain(`line-height: ${body.lineHeight}`)
    expect(css).toContain(`color: ${body.fill.toLowerCase()}`)
    for (const label of ["Email me a code", "Log out"]) {
      expect(css).toContain(`color: ${text(label).fill.toLowerCase()}`)
      expect(css).toContain(`font-size: ${text(label).fontSize}px`)
    }
  })
})
