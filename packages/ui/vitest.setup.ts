import { installUiSdkTestPlatform } from "./test/ui-sdk-platform"

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
