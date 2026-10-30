import { act, cleanup, configure } from "@testing-library/react"
import { toast } from "sonner"
import { afterEach, beforeEach, vi } from "vitest"

import "@testing-library/jest-dom/vitest"

import { resetUnauthorizedHandler } from "@/lib/api.ts"

import { resetMockSession } from "./auth-client-mock.ts"
import { resetApplyApiMock } from "./apply-api-mock.ts"
import { resetPaperApiMock } from "./paper-api-mock.ts"
import { resetProfileApiMock } from "./profile-api-mock.ts"
import { resetShellApiMock } from "./shell-api-mock.ts"
import { resetChatApiMock } from "./chat-api-mock.ts"

import {
  cleanupTestResources,
  registerTestCleanup,
  installSonnerTimerTracker,
  cleanupSonnerTimers,
} from "./test-resources.ts"

configure({ asyncUtilTimeout: 5000 })

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

if (
  typeof Element !== "undefined" &&
  typeof Element.prototype.scrollIntoView !== "function"
) {
  Element.prototype.scrollIntoView = function scrollIntoView() {}
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

installSonnerTimerTracker()

beforeEach(() => {
  toast.dismiss()
  resetMockSession()
  resetUnauthorizedHandler()
  resetChatApiMock()
  resetPaperApiMock()
  resetApplyApiMock()
  resetProfileApiMock()
  resetShellApiMock()
})

afterEach(async () => {
  try {
    cleanup()
  } finally {
    try {
      registerTestCleanup(cleanupSonnerTimers)
      await act(() => cleanupTestResources())
    } finally {
      if (typeof sessionStorage !== "undefined") sessionStorage.clear()
      if (typeof localStorage !== "undefined") localStorage.clear()
    }
  }
})
