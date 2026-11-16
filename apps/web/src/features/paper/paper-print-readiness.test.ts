import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { toast } from "sonner"

import { printPaper } from "./paper-print.ts"

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }))

function deferred() {
  let resolve: () => void = () => undefined
  let reject: (reason: Error) => void = () => undefined
  const promise = new Promise<void>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

let stops: (() => void)[] = []
let previousFonts: PropertyDescriptor | undefined
let print: ReturnType<typeof vi.spyOn>

function fonts(
  ready = Promise.resolve(),
  unrelatedFailure = false,
  requiredFaces: { family: string; status: string }[] = []
) {
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: Object.assign(
      new Set(
        unrelatedFailure ? [{ family: "OtherScreenFont", status: "error" }] : []
      ),
      {
        ready: Promise.resolve(),
        load: vi.fn(() => ready.then(() => requiredFaces)),
        check: vi.fn(() => true),
        status: "loaded",
      }
    ),
  })
}

function sheet() {
  const root = document.createElement("section")
  root.setAttribute("data-paper-print", "")
  root.textContent = "Distinctive Letter text"
  document.body.append(root)
  return root
}

function image(root: HTMLElement, ready = Promise.resolve()) {
  const img = document.createElement("img")
  img.src = "https://photos.test/first.png"
  img.alt = "Distinctive photo"
  Object.defineProperties(img, {
    complete: { configurable: true, value: true },
    naturalWidth: { configurable: true, value: 120 },
    naturalHeight: { configurable: true, value: 120 },
    decode: { configurable: true, value: () => ready },
  })
  root.append(img)
  return img
}

function begin(done = vi.fn()) {
  const stop = printPaper("Paper readiness", done)
  stops.push(stop)
  return { stop, done }
}

async function settle() {
  await vi.advanceTimersByTimeAsync(0)
}

beforeEach(() => {
  vi.useFakeTimers()
  document.title = "Workspace"
  previousFonts = Object.getOwnPropertyDescriptor(document, "fonts")
  fonts()
  print = vi.spyOn(window, "print").mockImplementation(() => undefined)
})

afterEach(() => {
  for (const stop of stops) stop()
  stops = []
  document
    .querySelectorAll("[data-paper-print]")
    .forEach((node) => node.remove())
  if (previousFonts) Object.defineProperty(document, "fonts", previousFonts)
  else Reflect.deleteProperty(document, "fonts")
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.mocked(toast.error).mockClear()
})

describe("Paper print readiness", () => {
  it("requires both the current photo decode and fonts before printing once", async () => {
    const photo = deferred()
    const font = deferred()
    fonts(font.promise)
    image(sheet(), photo.promise)
    begin()
    await settle()
    expect(print).not.toHaveBeenCalled()
    photo.resolve()
    await settle()
    expect(print).not.toHaveBeenCalled()
    font.resolve()
    await settle()
    expect(print).toHaveBeenCalledTimes(1)
  })

  it("refuses a failed photo, cleans up once and permits corrected retry", async () => {
    const photo = deferred()
    const img = image(sheet(), photo.promise)
    const { done } = begin()
    photo.reject(new Error("Unavailable photo"))
    await settle()
    expect(print).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(done).toHaveBeenCalledTimes(1)
    expect(document.body).not.toHaveAttribute("data-print")
    expect(document.title).toBe("Workspace")
    Object.defineProperty(img, "decode", { value: () => Promise.resolve() })
    begin()
    await settle()
    expect(print).toHaveBeenCalledTimes(1)
    window.dispatchEvent(new Event("afterprint"))
    expect(done).toHaveBeenCalledTimes(1)
  })

  it("refuses unresolved photo decoding when the deadline expires", async () => {
    const photo = deferred()
    image(sheet(), photo.promise)
    const { done } = begin()
    await vi.advanceTimersByTimeAsync(2000)
    expect(print).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(done).toHaveBeenCalledTimes(1)
    expect(document.body).not.toHaveAttribute("data-print")
    photo.resolve()
    await settle()
    expect(print).not.toHaveBeenCalled()
  })

  it("refuses a font readiness rejection", async () => {
    const font = deferred()
    fonts(font.promise)
    sheet()
    const { done } = begin()
    font.reject(new Error("Font unavailable"))
    await settle()
    expect(print).not.toHaveBeenCalled()
    expect(done).toHaveBeenCalledTimes(1)
    expect(toast.error).toHaveBeenCalledTimes(1)
  })

  it("refuses unresolved fonts when the deadline expires", async () => {
    fonts(deferred().promise)
    sheet()
    const { done } = begin()
    await vi.advanceTimersByTimeAsync(2000)
    expect(print).not.toHaveBeenCalled()
    expect(done).toHaveBeenCalledTimes(1)
    expect(toast.error).toHaveBeenCalledTimes(1)
  })

  it("allows an unrelated failed font when the fonts used by Paper load", async () => {
    fonts(Promise.resolve(), true)
    const root = sheet()
    root.style.fontFamily = "PaperFont"
    root.style.fontWeight = "700"
    root.style.fontStyle = "italic"
    begin()
    await settle()
    expect(print).toHaveBeenCalledTimes(1)
    expect(toast.error).not.toHaveBeenCalled()
    expect(document.fonts.load).toHaveBeenCalledWith(
      expect.stringContaining("PaperFont"),
      "Distinctive Letter text"
    )
    expect(document.fonts.load).toHaveBeenCalledWith(
      expect.stringContaining("700"),
      "Distinctive Letter text"
    )
    expect(document.fonts.load).toHaveBeenCalledWith(
      expect.stringContaining("italic"),
      "Distinctive Letter text"
    )
  })

  it("refuses failed loading for the exact used font family, weight and style", async () => {
    const font = deferred()
    fonts(font.promise)
    const root = sheet()
    root.style.fontFamily = "RequiredPaperFont"
    root.style.fontWeight = "700"
    root.style.fontStyle = "italic"
    begin()
    font.reject(new Error("RequiredPaperFont italic 700 failed"))
    await settle()
    expect(document.fonts.load).toHaveBeenCalledWith(
      expect.stringContaining("RequiredPaperFont"),
      "Distinctive Letter text"
    )
    expect(document.fonts.load).toHaveBeenCalledWith(
      expect.stringContaining("700"),
      "Distinctive Letter text"
    )
    expect(document.fonts.load).toHaveBeenCalledWith(
      expect.stringContaining("italic"),
      "Distinctive Letter text"
    )
    expect(print).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledTimes(1)
  })

  it.each(["src", "srcset", "sizes"])(
    "refuses changed image %s during decoding",
    async (attribute) => {
      const photo = deferred()
      const img = image(sheet(), photo.promise)
      begin()
      img.setAttribute(
        attribute,
        attribute === "sizes" ? "50vw" : "https://photos.test/second.png"
      )
      photo.resolve()
      await settle()
      expect(print).not.toHaveBeenCalled()
      expect(toast.error).toHaveBeenCalledTimes(1)
    }
  )

  it("refuses a source changed after decode while fonts remain pending", async () => {
    const font = deferred()
    fonts(font.promise)
    const img = image(sheet())
    begin()
    await settle()
    img.src = "https://photos.test/replaced.png"
    font.resolve()
    await settle()
    expect(print).not.toHaveBeenCalled()
  })

  it("refuses a changed selected source even when src attributes stay the same", async () => {
    const font = deferred()
    fonts(font.promise)
    const img = image(sheet())
    Object.defineProperty(img, "currentSrc", {
      configurable: true,
      value: "https://photos.test/first.png",
    })
    begin()
    await settle()
    Object.defineProperty(img, "currentSrc", {
      value: "https://photos.test/second.png",
    })
    font.resolve()
    await settle()
    expect(print).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledTimes(1)
  })

  it("refuses a required returned font face that reports failure", async () => {
    fonts(Promise.resolve(), false, [
      { family: "RequiredPaperFont", status: "error" },
    ])
    sheet().style.fontFamily = "RequiredPaperFont"
    const { done } = begin()
    await settle()
    expect(print).not.toHaveBeenCalled()
    expect(done).toHaveBeenCalledTimes(1)
    expect(toast.error).toHaveBeenCalledTimes(1)
  })

  it("refuses a font that becomes unavailable while the photo decodes", async () => {
    const photo = deferred()
    image(sheet(), photo.promise)
    begin()
    await settle()
    vi.mocked(document.fonts.check).mockReturnValue(false)
    photo.resolve()
    await settle()
    expect(print).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledTimes(1)
  })

  it("refuses changed required font descriptors while loading", async () => {
    const font = deferred()
    fonts(font.promise)
    const root = sheet()
    root.style.fontFamily = "RequiredPaperFont"
    root.style.fontWeight = "400"
    begin()
    root.style.fontWeight = "700"
    font.resolve()
    await settle()
    expect(print).not.toHaveBeenCalled()
  })

  it("refuses a print subtree removed after image decode while its font is pending", async () => {
    const font = deferred()
    fonts(font.promise)
    const root = sheet()
    image(root)
    const { done } = begin()
    await settle()
    root.remove()
    font.resolve()
    await settle()
    expect(print).not.toHaveBeenCalled()
    expect(done).toHaveBeenCalledTimes(1)
    expect(toast.error).toHaveBeenCalledTimes(1)
  })

  it.each(["replace", "remove", "add"])(
    "refuses a changed print image membership: %s",
    async (change) => {
      const photo = deferred()
      const root = sheet()
      const img = image(root, photo.promise)
      begin()
      if (change === "replace") {
        img.remove()
        image(root)
      } else if (change === "remove") root.remove()
      else image(root)
      photo.resolve()
      await settle()
      expect(print).not.toHaveBeenCalled()
      expect(toast.error).toHaveBeenCalledTimes(1)
    }
  )

  it.each(["missing source", "zero dimensions"])(
    "refuses %s even if decode claims success",
    async (kind) => {
      const img = image(sheet())
      if (kind === "missing source") img.removeAttribute("src")
      else Object.defineProperty(img, "naturalWidth", { value: 0 })
      begin()
      await settle()
      expect(print).not.toHaveBeenCalled()
    }
  )

  it("cancels quietly, releases the caller once and cannot print later", async () => {
    const photo = deferred()
    image(sheet(), photo.promise)
    const { stop, done } = begin()
    stop()
    stop()
    photo.resolve()
    await settle()
    window.dispatchEvent(new Event("afterprint"))
    expect(print).not.toHaveBeenCalled()
    expect(done).toHaveBeenCalledTimes(1)
    expect(toast.error).not.toHaveBeenCalled()
    expect(document.title).toBe("Workspace")
    expect(document.body).not.toHaveAttribute("data-print")
    expect(vi.getTimerCount()).toBe(0)
  })

  it("overlapping attempts cancel the first and preserve the newest title", async () => {
    sheet()
    const first = begin()
    const second = begin()
    first.stop()
    await settle()
    expect(print).toHaveBeenCalledTimes(1)
    expect(first.done).toHaveBeenCalledTimes(1)
    expect(document.title).toBe("Paper readiness")
    window.dispatchEvent(new Event("afterprint"))
    expect(second.done).toHaveBeenCalledTimes(1)
    expect(document.title).toBe("Workspace")
  })

  it("handles a thrown print dialog and permits another attempt", async () => {
    sheet()
    print.mockImplementationOnce(() => {
      throw new Error("Dialog blocked")
    })
    const first = begin()
    await settle()
    expect(first.done).toHaveBeenCalledTimes(1)
    expect(toast.error).toHaveBeenCalledTimes(1)
    begin()
    await settle()
    expect(print).toHaveBeenCalledTimes(2)
  })

  it("prints a no-image Letter and finishes exactly once after printing", async () => {
    sheet()
    const { done, stop } = begin()
    await settle()
    expect(print).toHaveBeenCalledTimes(1)
    expect(done).not.toHaveBeenCalled()
    window.dispatchEvent(new Event("afterprint"))
    window.dispatchEvent(new Event("afterprint"))
    stop()
    expect(done).toHaveBeenCalledTimes(1)
    expect(document.title).toBe("Workspace")
    expect(document.body).not.toHaveAttribute("data-print")
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(["load", "error", "empty"])(
    "waits for real image %s without decode",
    async (result) => {
      const img = image(sheet())
      Object.defineProperties(img, {
        decode: { value: undefined },
        complete: { value: false },
        naturalWidth: { configurable: true, value: 0 },
      })
      const { done } = begin()
      await settle()
      expect(print).not.toHaveBeenCalled()
      if (result === "load")
        Object.defineProperty(img, "naturalWidth", { value: 120 })
      Object.defineProperty(img, "complete", { value: true })
      img.dispatchEvent(new Event(result === "error" ? "error" : "load"))
      await settle()
      expect(print).toHaveBeenCalledTimes(result === "load" ? 1 : 0)
      if (result !== "load") expect(done).toHaveBeenCalledTimes(1)
    }
  )

  it.each([true, false])(
    "handles an already complete no-decode photo with valid dimensions: %s",
    async (valid) => {
      const img = image(sheet())
      Object.defineProperties(img, {
        decode: { value: undefined },
        naturalWidth: { value: valid ? 120 : 0 },
      })
      begin()
      await settle()
      expect(print).toHaveBeenCalledTimes(valid ? 1 : 0)
      expect(toast.error).toHaveBeenCalledTimes(valid ? 0 : 1)
    }
  )

  it("remains cancelled after later no-decode load and error events", async () => {
    const img = image(sheet())
    Object.defineProperties(img, {
      decode: { value: undefined },
      complete: { value: false },
      naturalWidth: { configurable: true, value: 0 },
    })
    const { stop, done } = begin()
    await settle()
    stop()
    Object.defineProperties(img, {
      complete: { value: true },
      naturalWidth: { value: 120 },
    })
    img.dispatchEvent(new Event("load"))
    img.dispatchEvent(new Event("error"))
    await settle()
    expect(print).not.toHaveBeenCalled()
    expect(done).toHaveBeenCalledTimes(1)
    expect(toast.error).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
})
