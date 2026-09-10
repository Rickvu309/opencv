import { afterEach, beforeEach, vi } from "vitest"

import "@testing-library/jest-dom/vitest"

import { resetUnauthorizedHandler } from "@/lib/api.ts"

import { resetMockSession } from "./auth-client-mock.ts"
import { resetApplyApiMock } from "./apply-api-mock.ts"
import { resetPaperApiMock } from "./paper-api-mock.ts"
import { resetPitchApiMock } from "./pitch-api-mock.ts"
import { resetProfileApiMock } from "./profile-api-mock.ts"
import { resetThreadApiMock } from "./threads-api-mock.ts"

vi.mock(
  "@/lib/auth-client.ts",
  async () => await import("./auth-client-mock.ts")
)

if (
  typeof document !== "undefined" &&
  typeof document.execCommand !== "function"
) {
  document.execCommand = () => false
}

if (
  typeof Element !== "undefined" &&
  typeof Element.prototype.scrollTo !== "function"
) {
  Element.prototype.scrollTo = function scrollTo() {}
}

if (typeof window !== "undefined") {
  window.scrollTo = () => {}
}

if (
  typeof window !== "undefined" &&
  typeof window.ResizeObserver !== "function"
) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  Object.defineProperty(window, "ResizeObserver", {
    writable: true,
    value: ResizeObserverStub,
  })
}

if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: !query.includes("max-width"),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

beforeEach(() => {
  resetMockSession()
  resetUnauthorizedHandler()
  resetThreadApiMock()
  resetPaperApiMock()
  resetPitchApiMock()
  resetApplyApiMock()
  resetProfileApiMock()
})

afterEach(() => {
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.clear()
  }
  if (typeof localStorage !== "undefined") {
    localStorage.clear()
  }
})
