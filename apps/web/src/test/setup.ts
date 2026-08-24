import { afterEach } from "vitest"

import "@testing-library/jest-dom/vitest"

afterEach(() => {
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.clear()
  }
})
