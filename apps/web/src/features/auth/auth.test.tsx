import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { AUTH_COPY } from "@/features/auth/auth-copy.ts"
import { apiFetch } from "@/lib/api.ts"
import { authClient } from "@/lib/auth-client.ts"
import { LANGUAGE_STORAGE_KEY } from "@/features/auth/auth-copy.ts"
import { SIGNED_OUT_EMAIL_KEY } from "@/lib/auth-redirect.ts"
import { setMockGoogle, setMockSession } from "@/test/auth-client-mock.ts"
import { pathOf } from "@/test/mock-http.ts"
import { setMockWelcomedAt } from "@/test/profile-api-mock.ts"
import { expectCoachIdle } from "@/test/coach-chat-helpers.ts"
import { renderApp } from "@/test/render-app.tsx"
import { SURFACE_PATHS } from "@/lib/product-paths.ts"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn())
})

function emailBox() {
  return screen.getByRole("textbox", { name: AUTH_COPY.email })
}

async function sendCode(address = "ada@verify.local") {
  fireEvent.change(emailBox(), { target: { value: address } })
  fireEvent.click(screen.getByRole("button", { name: AUTH_COPY.continue }))
  expect(
    await screen.findByRole("heading", { name: AUTH_COPY.checkEmail })
  ).toBeInTheDocument()
}

function pasteCode(otp: string) {
  fireEvent.paste(screen.getByRole("textbox", { name: "Digit 1" }), {
    clipboardData: { getData: () => otp },
  })
}

function refuseCode(code: string, status: number) {
  vi.mocked(authClient.signIn.emailOtp).mockResolvedValueOnce({
    data: null,
    error: { code, status, message: code },
  } as never)
}

async function openExpired() {
  renderApp(SURFACE_PATHS.coach)
  await expectCoachIdle()
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
  return screen.findByRole("dialog", { name: AUTH_COPY.loggedOutTitle })
}

describe("session guard", () => {
  it("sends a signed-out visitor to the email step", async () => {
    setMockSession(null)
    const { router } = renderApp(SURFACE_PATHS.paper)
    expect(
      await screen.findByRole("heading", { name: AUTH_COPY.logIn })
    ).toBeInTheDocument()
    expect(emailBox()).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: AUTH_COPY.continue })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("textbox", { name: "Password" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Create account" })
    ).not.toBeInTheDocument()
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/sign-in")
      expect(router.state.location.search).toEqual({
        redirect: SURFACE_PATHS.paper,
      })
    })
  })

  it("redirects /sign-up to /sign-in", async () => {
    setMockSession(null)
    const { router } = renderApp("/sign-up")
    expect(
      await screen.findByRole("heading", { name: AUTH_COPY.logIn })
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/sign-in")
    })
  })
})

describe("email code", () => {
  beforeEach(() => {
    setMockSession(null)
  })

  it("rejects a partial address without sending", async () => {
    renderApp("/sign-in")
    expect(
      await screen.findByRole("heading", { name: AUTH_COPY.logIn })
    ).toBeInTheDocument()
    fireEvent.change(emailBox(), { target: { value: "a@b" } })
    fireEvent.click(screen.getByRole("button", { name: AUTH_COPY.continue }))
    expect(await screen.findByRole("alert")).toHaveTextContent(
      AUTH_COPY.emailInvalid
    )
    expect(authClient.emailOtp.sendVerificationOtp).not.toHaveBeenCalled()
  })

  it("sends a code and shows the code step", async () => {
    renderApp("/sign-in")
    expect(
      await screen.findByRole("heading", { name: AUTH_COPY.logIn })
    ).toBeInTheDocument()
    expect(document.querySelectorAll('[data-variant="glow"]')).toHaveLength(1)
    await sendCode()
    expect(authClient.emailOtp.sendVerificationOtp).toHaveBeenCalledWith({
      email: "ada@verify.local",
      type: "sign-in",
    })
    expect(
      screen.getByRole("button", { name: AUTH_COPY.change })
    ).toBeInTheDocument()
    expect(document.querySelectorAll('[data-variant="glow"]')).toHaveLength(0)
  })

  it("hides Google until config says it is on", async () => {
    renderApp("/sign-in")
    expect(
      await screen.findByRole("heading", { name: AUTH_COPY.logIn })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: AUTH_COPY.google })
    ).not.toBeInTheDocument()
    expect(screen.queryByText(AUTH_COPY.or)).not.toBeInTheDocument()
  })

  it("starts Google when config allows it", async () => {
    setMockGoogle(true)
    renderApp("/sign-in")
    fireEvent.click(
      await screen.findByRole("button", { name: AUTH_COPY.google })
    )
    expect(authClient.signIn.social).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "google" })
    )
  })

  it("shows the Google error from search", async () => {
    renderApp("/sign-in?error=google")
    expect(await screen.findByRole("alert")).toHaveTextContent(
      AUTH_COPY.googleUnavailable
    )
  })

  it("signs in with a pasted code and follows redirect", async () => {
    const { router } = renderApp(SURFACE_PATHS.paper)
    expect(
      await screen.findByRole("heading", { name: AUTH_COPY.logIn })
    ).toBeInTheDocument()
    await sendCode("minh@example.com")
    pasteCode("048291")
    expect(authClient.signIn.emailOtp).toHaveBeenCalledWith({
      email: "minh@example.com",
      otp: "048291",
    })
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(SURFACE_PATHS.paper)
    })
  })

  it("clears the boxes when the code is wrong or expired", async () => {
    renderApp("/sign-in")
    expect(
      await screen.findByRole("heading", { name: AUTH_COPY.logIn })
    ).toBeInTheDocument()
    await sendCode()
    for (const code of ["INVALID_OTP", "OTP_EXPIRED"]) {
      refuseCode(code, 400)
      pasteCode("048291")
      expect(await screen.findByRole("alert")).toHaveTextContent(
        AUTH_COPY.codeBad
      )
      expect(
        screen.getByRole("button", { name: AUTH_COPY.sendNew })
      ).toBeInTheDocument()
      expect(screen.getByRole("textbox", { name: "Digit 1" })).toHaveValue("")
    }
  })

  it("stays put when sending is rate limited", async () => {
    vi.mocked(authClient.emailOtp.sendVerificationOtp).mockResolvedValueOnce({
      data: null,
      error: { status: 429, message: "Too many requests" },
    } as never)
    renderApp("/sign-in")
    expect(
      await screen.findByRole("heading", { name: AUTH_COPY.logIn })
    ).toBeInTheDocument()
    fireEvent.change(emailBox(), { target: { value: "ada@verify.local" } })
    fireEvent.click(screen.getByRole("button", { name: AUTH_COPY.continue }))
    expect(await screen.findByRole("alert")).toHaveTextContent(
      AUTH_COPY.tooManyCodes
    )
    expect(
      screen.getByRole("heading", { name: AUTH_COPY.logIn })
    ).toBeInTheDocument()
  })

  it("tabs Email, Continue, then the language control, and on the code step the digits, Send a new code, Change, then the language control", async () => {
    const user = userEvent.setup()
    renderApp("/sign-in")
    expect(
      await screen.findByRole("heading", { name: AUTH_COPY.logIn })
    ).toBeInTheDocument()

    await user.tab()
    expect(emailBox()).toHaveFocus()
    await user.tab()
    expect(
      screen.getByRole("button", { name: AUTH_COPY.continue })
    ).toHaveFocus()
    await user.tab()
    expect(screen.getByRole("radio", { name: AUTH_COPY.en })).toHaveFocus()

    await sendCode()
    refuseCode("INVALID_OTP", 400)
    pasteCode("048291")
    expect(
      await screen.findByRole("button", { name: AUTH_COPY.sendNew })
    ).toBeInTheDocument()
    // The resend button can appear before CodeInput's passive focus effect.
    // Start tabbing only after the rejected submission has restored focus.
    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "Digit 1" })).toHaveFocus()
    })
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }

    await user.tab()
    expect(screen.getByRole("button", { name: AUTH_COPY.change })).toHaveFocus()

    for (const name of [
      "Digit 1",
      "Digit 2",
      "Digit 3",
      "Digit 4",
      "Digit 5",
      "Digit 6",
    ]) {
      await user.tab()
      expect(screen.getByRole("textbox", { name })).toHaveFocus()
    }
    await user.tab()
    expect(
      screen.getByRole("button", { name: AUTH_COPY.sendNew })
    ).toHaveFocus()
    await user.tab()
    expect(screen.getByRole("radio", { name: AUTH_COPY.en })).toHaveFocus()
  })

  it("keeps English when VI is chosen", async () => {
    renderApp("/sign-in")
    expect(
      await screen.findByRole("heading", { name: AUTH_COPY.logIn })
    ).toBeInTheDocument()
    await sendCode()
    fireEvent.click(screen.getByRole("radio", { name: AUTH_COPY.vi }))
    expect(
      screen.getByRole("heading", { name: AUTH_COPY.checkEmail })
    ).toBeInTheDocument()
    expect(sessionStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("vi")
  })
})

describe("welcome", () => {
  it("marks welcome once and then shows the app", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }))
    const calls: string[] = []
    setMockWelcomedAt(null)
    renderApp(SURFACE_PATHS.coach, (input) => {
      calls.push(pathOf(input))
    })
    expect(
      await screen.findByRole("heading", { name: AUTH_COPY.welcome })
    ).toBeInTheDocument()
    expect(screen.getByText(AUTH_COPY.accountCreated)).toBeInTheDocument()
    expect(screen.getByText(AUTH_COPY.workspaceReady)).toBeInTheDocument()
    expect(screen.getByText(AUTH_COPY.coachReady)).toBeInTheDocument()
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: AUTH_COPY.welcome })
      ).not.toBeInTheDocument()
    })
    expect(calls).toContain("/api/commands/profile.markWelcomed")
  })

  it("skips welcome when the profile was already welcomed", async () => {
    setMockWelcomedAt("2026-01-02T00:00:00.000Z")
    renderApp(SURFACE_PATHS.coach)
    await expectCoachIdle()
    expect(
      screen.queryByRole("heading", { name: AUTH_COPY.welcome })
    ).not.toBeInTheDocument()
  })
})

describe("session expired", () => {
  it("keeps the dialog open on Escape and offers the remembered email", async () => {
    const dialog = await openExpired()
    expect(
      screen.getByRole("button", { name: "Continue as you@opencv.me" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: AUTH_COPY.emailMe })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: AUTH_COPY.logOut })
    ).toBeInTheDocument()
    expect(dialog.querySelectorAll('[data-variant="glow"]')).toHaveLength(1)
    fireEvent.keyDown(dialog, { key: "Escape" })
    expect(
      screen.getByRole("dialog", { name: AUTH_COPY.loggedOutTitle })
    ).toBeInTheDocument()
  })

  it("sends a code for Continue as", async () => {
    await openExpired()
    fireEvent.click(
      screen.getByRole("button", { name: "Continue as you@opencv.me" })
    )
    expect(authClient.emailOtp.sendVerificationOtp).toHaveBeenCalledWith({
      email: "you@opencv.me",
      type: "sign-in",
    })
    expect(
      await screen.findByRole("heading", { name: AUTH_COPY.checkEmail })
    ).toBeInTheDocument()
  })

  it("opens a blank email step for Email me a code", async () => {
    await openExpired()
    fireEvent.click(screen.getByRole("button", { name: AUTH_COPY.emailMe }))
    expect(
      await screen.findByRole("heading", { name: AUTH_COPY.logIn })
    ).toBeInTheDocument()
    expect(emailBox()).toHaveValue("")
    expect(authClient.emailOtp.sendVerificationOtp).not.toHaveBeenCalled()
  })

  it("logs out and clears the remembered email", async () => {
    await openExpired()
    fireEvent.click(screen.getByRole("button", { name: AUTH_COPY.logOut }))
    expect(authClient.signOut).toHaveBeenCalled()
    expect(
      await screen.findByRole("heading", { name: AUTH_COPY.logIn })
    ).toBeInTheDocument()
    expect(sessionStorage.getItem(SIGNED_OUT_EMAIL_KEY)).toBeNull()
    expect(sessionStorage.getItem(LANGUAGE_STORAGE_KEY)).toBeNull()
  })
})
