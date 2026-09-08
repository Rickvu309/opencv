import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react"

import { SEARCH_PATH, SURFACE_PATHS } from "@/features/app-shell/surfaces.ts"
import { SIGN_UP_COPY } from "@/features/auth/sign-up-copy.ts"
import { authClient } from "@/lib/auth-client.ts"
import { setMockSession } from "@/test/auth-client-mock.ts"
import { expectPaperDrive } from "@/test/paper-drive.ts"
import { renderApp } from "@/test/render-app.tsx"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn())
})

describe("session guard", () => {
  it("sends a signed-out visitor from every surface to sign-in", async () => {
    setMockSession(null)

    for (const path of [...Object.values(SURFACE_PATHS), SEARCH_PATH]) {
      cleanup()
      const { router } = renderApp(path)

      expect(
        await screen.findByRole("heading", { name: "Welcome back" })
      ).toBeInTheDocument()
      expect(
        screen.getByRole("button", { name: "Sign in" })
      ).toBeInTheDocument()
      expect(
        screen.queryByRole("heading", { name: SIGN_UP_COPY.title })
      ).not.toBeInTheDocument()
      await waitFor(() => {
        expect(router.state.location.pathname).toBe("/sign-in")
        expect(router.state.location.search).toEqual({ redirect: path })
      })
    }
  })

  it("keeps sign-in and sign-up reachable without a session", async () => {
    setMockSession(null)
    renderApp("/sign-in")
    expect(
      await screen.findByRole("heading", { name: "Welcome back" })
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("link", { name: "Create an account" }))
    expect(
      await screen.findByRole("heading", { name: SIGN_UP_COPY.title })
    ).toBeInTheDocument()
    expect(screen.getByText(SIGN_UP_COPY.body)).toBeInTheDocument()
    expect(screen.queryByText(/Threads, Paper, and Apply/)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Create account" })).toBeTruthy()
  })
})

describe("auth flows", () => {
  it("returns to the originally requested surface after sign-in", async () => {
    setMockSession(null)
    const { router } = renderApp("/app/paper")

    expect(
      await screen.findByRole("heading", { name: "Welcome back" })
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "minh@example.com" },
    })
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "correct-horse" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }))

    expect(authClient.signIn.email).toHaveBeenCalledWith({
      email: "minh@example.com",
      password: "correct-horse",
    })
    await expectPaperDrive()
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(SURFACE_PATHS.paper)
    })
  })

  it("lands on Home after sign-up", async () => {
    setMockSession(null)
    const { router } = renderApp("/sign-up")

    expect(
      await screen.findByRole("heading", { name: SIGN_UP_COPY.title })
    ).toBeInTheDocument()
    expect(screen.getByText(SIGN_UP_COPY.body)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Lan Nguyen" },
    })
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "lan@example.com" },
    })
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "correct-horse" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Create account" }))

    expect(authClient.signUp.email).toHaveBeenCalledWith({
      name: "Lan Nguyen",
      email: "lan@example.com",
      password: "correct-horse",
    })
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: /^Good (morning|afternoon|evening), Lan Nguyen$/,
      })
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(SURFACE_PATHS.home)
    })
  })

  it("shows a form error when sign-in is refused", async () => {
    setMockSession(null)
    vi.mocked(authClient.signIn.email).mockResolvedValueOnce({
      data: null,
      error: { message: "Invalid email or password" },
    } as never)

    renderApp("/sign-in")
    expect(
      await screen.findByRole("heading", { name: "Welcome back" })
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "minh@example.com" },
    })
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrong-password" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid email or password"
    )
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeTruthy()
  })
})
