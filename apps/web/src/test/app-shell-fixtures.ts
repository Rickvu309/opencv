import { screen, within } from "@testing-library/react"
import { expect, vi } from "vitest"

import { SURFACE_COPY } from "@/features/app-shell/surfaces.ts"
import { DESKTOP_MEDIA_QUERY } from "@/features/app-shell/use-media-query.ts"
import { SAMPLE_AUTHOR_NAME } from "@/features/seed/sample-author.ts"

export const NAV = ["Inbox", "Coach", "Jobs", "Paper", "Apply", "Pitch"]

export function stubDesktopViewport(isDesktop: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === DESKTOP_MEDIA_QUERY ? isDesktop : true,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }))
}

export function linkNames(root: HTMLElement) {
  return within(root)
    .getAllByRole("link")
    .map((el) => el.getAttribute("aria-label") || el.textContent?.trim())
}

async function expectHeading(name: string) {
  expect(
    await screen.findByRole("heading", { level: 1, name })
  ).toBeInTheDocument()
}

export async function expectPitch() {
  expect(await screen.findByText("Pitch. Coming soon.")).toBeInTheDocument()
}

export async function expectApplyLive() {
  await expectHeading("Apply")
  expect(screen.getByRole("button", { name: "Board" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Calendar" })).toBeInTheDocument()
  expect(
    await screen.findByRole("heading", { name: "Track your first job" })
  ).toBeInTheDocument()
  expect(screen.queryByText(SURFACE_COPY.apply.body)).not.toBeInTheDocument()
}

export async function expectHomeIdle() {
  expect(
    await screen.findByRole("heading", {
      level: 1,
      name: new RegExp(
        `^Good (morning|afternoon|evening), ${SAMPLE_AUTHOR_NAME}$`
      ),
    })
  ).toBeInTheDocument()
}
