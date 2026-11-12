import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"

import { cv, renderLibrary } from "@/features/paper/paper-library.fixtures.tsx"
import { renderApp } from "@/test/render-app.tsx"

async function tabCycle(dialog: HTMLElement, backwards: boolean) {
  const user = userEvent.setup()
  await waitFor(() =>
    expect(dialog.contains(document.activeElement)).toBe(true)
  )
  const stops = dialog.querySelectorAll(
    "button:not([disabled]),input:not([type=hidden]),textarea,a[href]"
  ).length
  const visits: string[] = []
  for (let press = 0; press < stops + 2; press += 1) {
    await user.tab({ shift: backwards })
    const active = document.activeElement
    if (!dialog.contains(active))
      visits.push(`${active?.tagName ?? "none"} ${active?.textContent ?? ""}`)
  }
  return visits
}

afterEach(() => {
  cleanup()
})

describe("the dialogs people reported keep Tab inside for a full cycle", () => {
  it.each([false, true])(
    "Paper delete confirmation, backwards %s",
    async (backwards) => {
      const user = userEvent.setup()
      const doc = cv("Linh CV")
      renderLibrary([doc])
      await user.click(screen.getByRole("button", { name: `${doc.name} menu` }))
      await user.click(await screen.findByRole("menuitem", { name: "Delete" }))
      const dialog = await screen.findByRole("dialog", {
        name: "Delete this CV?",
      })
      expect(await tabCycle(dialog, backwards)).toEqual([])
    }
  )

  it.each([false, true])("New job dialog, backwards %s", async (backwards) => {
    renderApp("/apply")
    fireEvent.click(await screen.findByRole("button", { name: "New job" }))
    const dialog = await screen.findByRole("dialog", { name: "New job" })
    expect(await tabCycle(dialog, backwards)).toEqual([])
  })
})
