import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, vi } from "vitest"

import { DESKTOP_MEDIA_QUERY } from "@/lib/use-media-query.ts"

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
  await expectHeading("Pitch")
  expect(
    screen.getByRole("heading", { level: 2, name: "One link that sells you" })
  ).toBeInTheDocument()
}

export async function expectApplyLive() {
  await expectHeading("Apply")
  expect(screen.getByRole("radio", { name: "Board" })).toBeInTheDocument()
  expect(screen.getByRole("radio", { name: "Calendar" })).toBeInTheDocument()
  expect(
    await screen.findByRole("heading", { name: "Track your first job" })
  ).toBeInTheDocument()
}

export function accountTrigger() {
  const trigger = document.querySelector<HTMLElement>(
    "[data-slot='account-trigger']"
  )
  if (!trigger) throw new Error("account trigger is not on screen")
  return trigger
}

export async function openAccountMenu() {
  await userEvent.click(accountTrigger())
  return screen.findByRole("menu")
}
