import { installUiSdkTestPlatform } from "./src/lib/ui-sdk-test-platform"

installUiSdkTestPlatform()

Object.defineProperty(globalThis, "ResizeObserver", {
  configurable: true,
  writable: true,
  value: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
})
