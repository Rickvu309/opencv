import { describe, expect, it } from "vitest"
import { screen } from "@testing-library/react"

import { SURFACES } from "@/lib/product-paths.ts"
import { renderApp } from "@/test/render-app.tsx"
import { showSkippedInbox } from "@/test/shell-api-mock.ts"

const pages = SURFACES.filter((surface) => surface.shown)

function titleBars(root: ParentNode) {
  const headers = root.querySelectorAll('[data-slot="page-header"]')
  if (headers.length > 0) return headers.length
  return root.querySelectorAll("h1").length
}

describe("product pages", () => {
  it.each(pages)("$path has one page title", async (surface) => {
    if (surface.id === "inbox") showSkippedInbox()
    renderApp(surface.path)
    await screen.findByRole("heading", { level: 1 })
    const root = document.querySelector("#app-main") ?? document.body
    expect(titleBars(root), surface.id).toBe(1)
  })
})
