import { expect } from "vitest"
import { fireEvent, screen } from "@testing-library/react"

export async function expectHomeIdle() {
  expect(
    await screen.findByRole("heading", { name: "How can I help?" })
  ).toBeInTheDocument()
  expect(
    screen.getByRole("textbox", { name: "Message Coach" })
  ).toBeInTheDocument()
}

export function openGetStarted() {
  const toggle = screen.queryByRole("button", { name: "Get started" })
  if (toggle?.getAttribute("aria-expanded") === "false") fireEvent.click(toggle)
}

export async function expectHomeStarted() {
  await expectHomeIdle()
  openGetStarted()
}

export function firstCafeList() {
  return screen.getByRole("region", { name: "Four small things" })
}

export function firstCafeNudge() {
  return screen.getByRole("region", { name: "One next thing" })
}

export function firstCafeQuietDone() {
  return screen.getByRole("region", { name: "You're set" })
}
