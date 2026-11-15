import { describe, expect, it, vi } from "vitest"
import { screen } from "@testing-library/react"

import { authMockState, setMockSession } from "@/test/auth-client-mock.ts"
import { setMockWelcomedAt } from "@/test/profile-api-mock.ts"
import { renderPage } from "@/test/render-app.tsx"
import { AUTH_COPY } from "./auth-copy.ts"
import { ShellOverlays } from "./shell-overlays.tsx"
import { SignInScreen } from "./sign-in-screen.tsx"

function denySessionStorage(kind: "getter" | "getItem" | "setItem") {
  if (kind !== "getter") {
    const method = vi.spyOn(Storage.prototype, kind).mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError")
    })
    return () => method.mockRestore()
  }
  const descriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "sessionStorage"
  )
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    get() {
      throw new DOMException("blocked", "SecurityError")
    },
  })
  return () => {
    if (descriptor)
      Object.defineProperty(globalThis, "sessionStorage", descriptor)
    else Reflect.deleteProperty(globalThis, "sessionStorage")
  }
}

describe("optional session hints during startup", () => {
  it.each(["getter", "setItem"] as const)(
    "keeps the signed-in workspace open when %s is denied",
    async (kind) => {
      setMockWelcomedAt("2026-01-02T00:00:00.000Z")
      const session = authMockState.data
      expect(session).not.toBeNull()
      const restore = denySessionStorage(kind)
      try {
        renderPage(() => (
          <ShellOverlays>
            <h1>Workspace content</h1>
          </ShellOverlays>
        ))
        expect(
          await screen.findByRole("heading", { name: "Workspace content" })
        ).toBeInTheDocument()
        expect(authMockState.data).toBe(session)
      } finally {
        restore()
      }
    }
  )

  it.each(["getter", "getItem"] as const)(
    "renders English sign-in when %s is denied",
    async (kind) => {
      setMockSession(null)
      const restore = denySessionStorage(kind)
      try {
        renderPage(SignInScreen)
        expect(
          await screen.findByRole("heading", { name: AUTH_COPY.logIn })
        ).toBeInTheDocument()
        expect(
          screen.getByRole("textbox", { name: AUTH_COPY.email })
        ).toBeInTheDocument()
        expect(
          screen.getByRole("button", { name: AUTH_COPY.continue })
        ).toBeInTheDocument()
      } finally {
        restore()
      }
    }
  )
})
