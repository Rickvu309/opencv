import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react"

import { AUTH_COPY } from "@/features/auth/auth-copy.ts"
import {
  failMockSessionCheck,
  setMockSession,
  type MockSessionFailure,
} from "@/test/auth-client-mock.ts"
import { renderApp } from "@/test/render-app.tsx"

const SLOW = { timeout: 4000 }

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

async function signedInOnApply() {
  vi.stubGlobal("scrollTo", vi.fn())
  const { router } = renderApp("/apply")
  await screen.findByRole("navigation", { name: "Main" }, SLOW)
  return router
}

describe("session check routing", () => {
  it.each<MockSessionFailure>(["rate-limited", "network", "server-error"])(
    "a %s session check keeps a signed-in person on their page",
    async (failure) => {
      const router = await signedInOnApply()
      failMockSessionCheck(failure)
      await router.navigate({ to: "/settings" })
      await waitFor(
        () => expect(router.state.location.pathname).toBe("/settings"),
        SLOW
      )
      expect(
        await screen.findByText(AUTH_COPY.sessionCheckNotice, {}, SLOW)
      ).toBeInTheDocument()
      expect(
        screen.queryByRole("heading", { name: AUTH_COPY.logIn })
      ).not.toBeInTheDocument()
    },
    10_000
  )

  it("a session check that says there is no session sends the person to sign-in", async () => {
    const router = await signedInOnApply()
    setMockSession(null)
    await router.navigate({ to: "/settings" })
    await screen.findByRole("heading", { name: AUTH_COPY.logIn }, SLOW)
    expect(router.state.location.pathname).toBe("/sign-in")
    expect(
      screen.queryByRole("navigation", { name: "Main" })
    ).not.toBeInTheDocument()
  })

  it("a first load with a failing session check shows a retry state, then recovers without a reload", async () => {
    vi.stubGlobal("scrollTo", vi.fn())
    failMockSessionCheck("rate-limited")
    const { router } = renderApp("/apply")
    await screen.findByRole(
      "heading",
      { name: AUTH_COPY.sessionCheckTitle },
      SLOW
    )
    expect(router.state.location.pathname).toBe("/apply")
    expect(
      screen.queryByRole("heading", { name: AUTH_COPY.logIn })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("navigation", { name: "Main" })
    ).not.toBeInTheDocument()

    failMockSessionCheck(null)
    fireEvent.click(
      screen.getByRole("button", { name: AUTH_COPY.sessionCheckRetry })
    )
    await screen.findByRole("navigation", { name: "Main" }, SLOW)
    expect(router.state.location.pathname).toBe("/apply")
  }, 10_000)

  it("the notice's retry clears the notice once the check answers", async () => {
    const router = await signedInOnApply()
    failMockSessionCheck("rate-limited")
    await router.navigate({ to: "/settings" })
    await screen.findByText(AUTH_COPY.sessionCheckNotice, {}, SLOW)
    failMockSessionCheck(null)
    fireEvent.click(
      screen.getByRole("button", { name: AUTH_COPY.sessionCheckRetry })
    )
    await waitFor(
      () =>
        expect(
          screen.queryByText(AUTH_COPY.sessionCheckNotice)
        ).not.toBeInTheDocument(),
      SLOW
    )
    expect(router.state.location.pathname).toBe("/settings")
  }, 10_000)
})
