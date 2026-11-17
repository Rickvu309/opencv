import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, screen } from "@testing-library/react"

import { AUTH_COPY } from "@/features/auth/auth-copy.ts"
import { authClient } from "@/lib/auth-client.ts"
import { setMockSession } from "@/test/auth-client-mock.ts"
import { renderApp } from "@/test/render-app.tsx"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn())
  setMockSession(null)
})

function emailBox() {
  return screen.getByRole("textbox", { name: AUTH_COPY.email })
}

function continueButton() {
  return screen.getByRole("button", { name: AUTH_COPY.continue })
}

function refuseSending(retryAfter: string | null) {
  vi.mocked(authClient.emailOtp.sendVerificationOtp).mockImplementationOnce(
    (async (input: {
      fetchOptions?: { onError?: (context: { response: Response }) => void }
    }) => {
      input.fetchOptions?.onError?.({
        response: new Response(null, {
          status: 429,
          headers: retryAfter ? { "Retry-After": retryAfter } : {},
        }),
      })
      return { data: null, error: { status: 429, message: "Too many" } }
    }) as never
  )
}

async function openSignIn() {
  renderApp("/sign-in")
  return screen.findByRole("heading", { name: AUTH_COPY.logIn })
}

describe("sign-in look", () => {
  it("puts the mark above the title and keeps the title's name", async () => {
    const heading = await openSignIn()
    expect(heading.firstElementChild?.getAttribute("data-slot")).toBe("mark")
    expect(heading).toHaveTextContent("Log in to OpenCV")
  })

  it("makes Continue a solid primary with hover and pressed fills and the input's radius", async () => {
    await openSignIn()
    const button = continueButton()
    expect(button).toHaveAttribute("data-variant", "primary")
    expect(button.className).toContain("bg-primary")
    expect(button.className).toContain("text-primary-foreground")
    expect(button.className).toMatch(/(^|\s)hover:bg-/)
    expect(button.className).toMatch(/(^|\s)active:bg-/)
    expect(button.className).toContain("rounded-[10px]")
    expect(emailBox().className).toContain("rounded-[10px]")
    expect(button).toBeEnabled()
  })

  it("explains the stored Vietnamese choice while menus stay in English", async () => {
    await openSignIn()
    const status = screen.getByRole("status")
    expect(status).toBeEmptyDOMElement()
    fireEvent.click(screen.getByRole("radio", { name: "VI" }))
    expect(status).toHaveTextContent(AUTH_COPY.vietnameseNotice)
    expect(screen.getByRole("radio", { name: "VI" })).toBeChecked()
    expect(continueButton()).toBeVisible()
    fireEvent.click(screen.getByRole("radio", { name: "EN" }))
    expect(status).toBeEmptyDOMElement()
  })

  it("marks the field when the email is not a full address", async () => {
    await openSignIn()
    fireEvent.change(emailBox(), { target: { value: "a@b" } })
    fireEvent.click(continueButton())
    expect(await screen.findByRole("alert")).toHaveTextContent(
      AUTH_COPY.emailInvalid
    )
    expect(emailBox()).toHaveAttribute("aria-invalid", "true")
    expect(emailBox()).toHaveAccessibleDescription(AUTH_COPY.emailInvalid)
    expect(continueButton()).toBeEnabled()
  })

  it("lets the app's own message speak for an address without a dot", async () => {
    await openSignIn()
    fireEvent.change(emailBox(), { target: { value: "ada" } })
    fireEvent.submit(emailBox().closest("form")!)
    expect(emailBox().closest("form")).toHaveAttribute("novalidate")
    expect(await screen.findByRole("alert")).toHaveTextContent(
      AUTH_COPY.emailInvalid
    )
    expect(authClient.emailOtp.sendVerificationOtp).not.toHaveBeenCalled()
  })

  it("leaves Continue usable when the limit gives no wait to count down", async () => {
    refuseSending(null)
    await openSignIn()
    fireEvent.change(emailBox(), { target: { value: "ada@verify.local" } })
    fireEvent.click(continueButton())
    expect(await screen.findByRole("alert")).toHaveTextContent(
      AUTH_COPY.tooManyCodes
    )
    expect(continueButton()).toBeEnabled()
    expect(emailBox()).not.toHaveAttribute("aria-invalid")
    expect(emailBox()).not.toHaveAttribute("aria-describedby")
  })

  it("focuses the email field after Back to login, keeps the email and sends nothing going back and forth", async () => {
    await openSignIn()
    fireEvent.change(emailBox(), { target: { value: "ada@verify.local" } })
    fireEvent.click(continueButton())
    expect(
      await screen.findByRole("heading", { name: AUTH_COPY.checkEmail })
    ).toBeInTheDocument()
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    vi.mocked(authClient.emailOtp.sendVerificationOtp).mockClear()
    fireEvent.click(screen.getByRole("button", { name: AUTH_COPY.backToLogin }))
    expect(
      await screen.findByRole("heading", { name: AUTH_COPY.logIn })
    ).toBeInTheDocument()
    expect(emailBox()).toHaveValue("ada@verify.local")
    expect(document.activeElement).toBe(emailBox())
    expect(continueButton()).toBeEnabled()
    expect(screen.queryByRole("alert")).toBeNull()
    expect(authClient.emailOtp.sendVerificationOtp).not.toHaveBeenCalled()
    expect(authClient.signIn.emailOtp).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

const A = "ada@verify.local"
const B = "bea@verify.local"
const START = Date.UTC(2026, 10, 13, 9, 0, 0)

function typeEmail(value: string) {
  fireEvent.change(emailBox(), { target: { value } })
}

function heldShows(expected: {
  continueEnabled: boolean
  error: string | null
}) {
  if (expected.continueEnabled) expect(continueButton()).toBeEnabled()
  else expect(continueButton()).toBeDisabled()
  const alert = screen.queryByRole("alert")
  if (expected.error === null) {
    expect(alert).toBeNull()
    expect(emailBox()).not.toHaveAttribute("aria-invalid")
  } else {
    expect(alert).toHaveTextContent(expected.error)
    expect(emailBox()).not.toHaveAttribute("aria-invalid")
    expect(emailBox()).not.toHaveAttribute("aria-describedby")
  }
}

async function refuseA(retryAfter = "120") {
  vi.useFakeTimers({
    shouldAdvanceTime: true,
    toFake: ["Date", "setInterval", "clearInterval"],
  })
  vi.setSystemTime(START)
  refuseSending(retryAfter)
  await openSignIn()
  typeEmail(A)
  await act(async () => {
    fireEvent.click(continueButton())
  })
  await screen.findByRole("alert")
  await act(async () => {})
  vi.mocked(authClient.emailOtp.sendVerificationOtp).mockClear()
}

function tick(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

function jumpClock(ms: number) {
  act(() => {
    vi.setSystemTime(Date.now() + ms)
  })
}

const TWO_MINUTES = "Too many codes. Try again in about 2 minutes."
const ONE_MINUTE = "Too many codes. Try again in about 1 minute."

describe("code limit hold, per address and against the clock", () => {
  it("before any refusal both addresses can continue", async () => {
    await openSignIn()
    typeEmail(A)
    heldShows({ continueEnabled: true, error: null })
    typeEmail(B)
    heldShows({ continueEnabled: true, error: null })
  })

  it("during the wait holds only the refused address", async () => {
    await refuseA()
    heldShows({ continueEnabled: false, error: TWO_MINUTES })
    typeEmail(B)
    heldShows({ continueEnabled: true, error: null })
    typeEmail(A.toUpperCase())
    heldShows({ continueEnabled: false, error: TWO_MINUTES })
    typeEmail(B)
    heldShows({ continueEnabled: true, error: null })
    typeEmail(A)
    heldShows({ continueEnabled: false, error: TWO_MINUTES })
    expect(authClient.emailOtp.sendVerificationOtp).not.toHaveBeenCalled()
  })

  it("lets B send while A is held, then A stays held", async () => {
    await refuseA()
    typeEmail(B)
    fireEvent.click(continueButton())
    expect(
      await screen.findByRole("heading", { name: AUTH_COPY.checkEmail })
    ).toBeInTheDocument()
    expect(authClient.emailOtp.sendVerificationOtp).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole("button", { name: AUTH_COPY.backToLogin }))
    await screen.findByRole("heading", { name: AUTH_COPY.logIn })
    expect(document.activeElement).toBe(emailBox())
    heldShows({ continueEnabled: true, error: null })
    typeEmail(A)
    heldShows({ continueEnabled: false, error: TWO_MINUTES })
  })

  it("counts the message down and clears it with the hold at the end of the wait", async () => {
    await refuseA()
    tick(61_000)
    heldShows({ continueEnabled: false, error: ONE_MINUTE })
    tick(58_000)
    heldShows({ continueEnabled: false, error: ONE_MINUTE })
    tick(1_000)
    heldShows({ continueEnabled: true, error: null })
    tick(60_000)
    heldShows({ continueEnabled: true, error: null })
    typeEmail(B)
    typeEmail(A)
    heldShows({ continueEnabled: true, error: null })
    expect(authClient.emailOtp.sendVerificationOtp).not.toHaveBeenCalled()
  })

  it("releases when the tab comes back after the wait ended while hidden", async () => {
    await refuseA()
    jumpClock(5 * 60_000)
    heldShows({ continueEnabled: false, error: TWO_MINUTES })
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"))
    })
    heldShows({ continueEnabled: true, error: null })
  })

  it("releases on the next tick when the clock jumps past the wait, as after sleep", async () => {
    await refuseA()
    jumpClock(10 * 60_000)
    tick(1_000)
    heldShows({ continueEnabled: true, error: null })
  })

  it("releases at once when the person types after the clock jumped past the wait", async () => {
    await refuseA()
    jumpClock(3 * 60_000)
    typeEmail(B)
    typeEmail(A)
    heldShows({ continueEnabled: true, error: null })
  })

  it("never holds longer than an hour, whatever the wait says", async () => {
    await refuseA("86400")
    expect(continueButton()).toBeDisabled()
    tick(60 * 60_000)
    heldShows({ continueEnabled: true, error: null })
  })

  it("is gone after a reload, leaving the server to refuse again", async () => {
    await refuseA()
    cleanup()
    await openSignIn()
    typeEmail(A)
    heldShows({ continueEnabled: true, error: null })
    expect(authClient.emailOtp.sendVerificationOtp).not.toHaveBeenCalled()
  })
})
