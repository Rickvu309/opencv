import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"

import { AppShell } from "./app-shell.tsx"

afterEach(cleanup)

describe("AppShell overlay", () => {
  it("renders overlay layers outside the animated panel, so the panel's transform cannot clip them", () => {
    render(
      <AppShell active="inbox" overlay={<div>overlay layer</div>}>
        <div>panel content</div>
      </AppShell>
    )
    expect(screen.getByText("overlay layer").closest(".oc-panel")).toBeNull()
    expect(
      screen.getByText("panel content").closest(".oc-panel")
    ).not.toBeNull()
  })
})
