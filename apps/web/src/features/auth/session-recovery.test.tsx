import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react"

import { AUTH_COPY } from "@/features/auth/auth-copy.ts"
import { apiFetch } from "@/lib/api.ts"
import { mockJob } from "@/test/apply-job-fixtures.ts"
import { setMockJobs } from "@/test/apply-jobs-mock.ts"
import { renderApp } from "@/test/render-app.tsx"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const jobPath = "/apply/01900000-0000-7000-8000-000000000001"
const destination = `${jobPath}?source=calendar#notes`

async function expireOnJob() {
  vi.stubGlobal("scrollTo", vi.fn())
  setMockJobs([
    mockJob({
      id: "01900000-0000-7000-8000-000000000001",
      title: "Recovery destination job",
      company: "Journey proof",
      stage: "saved",
      position: "a0",
    }),
  ])
  const { router } = renderApp(destination)
  await screen.findByRole("navigation", { name: "Breadcrumb" })
  const fetch = globalThis.fetch
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
  await screen.findByRole("dialog", { name: AUTH_COPY.loggedOutTitle })
  vi.stubGlobal("fetch", fetch)
  return router
}

describe("session recovery destination", () => {
  it.each(["remembered email", "another email"])(
    "returns to the same job after signing in with %s",
    async (choice) => {
      const router = await expireOnJob()
      fireEvent.click(
        screen.getByRole("button", {
          name:
            choice === "remembered email"
              ? "Continue as you@opencv.me"
              : AUTH_COPY.emailMe,
        })
      )
      if (choice === "another email") {
        const email = await screen.findByRole("textbox", {
          name: AUTH_COPY.email,
        })
        expect(email).toHaveValue("")
        fireEvent.change(email, { target: { value: "ada@verify.local" } })
        fireEvent.click(
          screen.getByRole("button", { name: AUTH_COPY.continue })
        )
      }
      await screen.findByRole("heading", { name: AUTH_COPY.checkEmail })
      expect(router.state.location.search).toMatchObject({
        redirect: destination,
      })
      fireEvent.paste(screen.getByRole("textbox", { name: "Digit 1" }), {
        clipboardData: { getData: () => "048291" },
      })
      await waitFor(() => {
        expect(router.state.location.href).toBe(destination)
      })
      expect(
        await screen.findByRole("navigation", { name: "Breadcrumb" })
      ).toBeInTheDocument()
    }
  )
})
