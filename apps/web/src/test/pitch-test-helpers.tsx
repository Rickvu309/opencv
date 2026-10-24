import { createElement, type ReactNode } from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { expect, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { SAMPLE_AUTHOR_NAME } from "@/features/seed/sample-author.ts"
import { PitchWorkspace } from "@/features/pitch/pitch-workspace.tsx"
import { createQueryClient } from "@/lib/query-client.ts"
import { pitchApiFetch } from "@/test/pitch-api-mock.ts"

function installPitchFetch() {
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const res = await pitchApiFetch(input, init)
      if (res) return res
      throw new Error(`unexpected fetch: ${String(input)}`)
    }
  )
}

function wrapper({ children }: { children: ReactNode }) {
  return createElement(
    QueryClientProvider,
    { client: createQueryClient() },
    children
  )
}

export function renderPitch() {
  installPitchFetch()
  return render(createElement(PitchWorkspace), { wrapper })
}

export function clearDemoButtons() {
  return screen.getAllByRole("button", { name: "Clear demo" })
}

export function clickClearDemo() {
  fireEvent.click(clearDemoButtons()[0]!)
}

export function expectSampleMomentsGone() {
  expect(screen.queryByText(/Sample · campus club/i)).not.toBeInTheDocument()
  expect(screen.queryByText("+18%")).not.toBeInTheDocument()
  expect(screen.queryByText(/add-to-cart lift/i)).not.toBeInTheDocument()
  expect(
    screen.queryByRole("button", { name: "Checkout highlight" })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole("button", { name: "Club sprint highlight" })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole("button", { name: "Wallet audit highlight" })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByText("Tap a highlight to play it.")
  ).not.toBeInTheDocument()
}

export async function loadedPitch() {
  renderPitch()
  expect(
    await screen.findByRole("heading", { level: 2, name: SAMPLE_AUTHOR_NAME })
  ).toBeInTheDocument()
}
