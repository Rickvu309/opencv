import * as Y from "yjs"
import {
  createPrivateFlow,
  readFlow,
  openFlowBinary,
} from "./native-layout-flow.js"
import { mountPrivateFlow } from "./native-layout-flow-mount.js"
import { flowPhotoControls } from "./native-layout-photo-controls.js"
import { storedFlowFixture } from "./test/flow-fixture.js"
import {
  afterAll,
  beforeAll,
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"
import {
  canonical,
  photoBounds,
  type Result,
} from "@workspace/domain/internal/paper-presentation"
import {
  createPrivateLayout,
  readLayout,
  commitLayoutPhotoEdit,
  type LayoutBinding,
} from "./native-layout.js"
import { mountPrivateLayout } from "./native-layout-mount.js"
import { photoFixture, photoLayoutFixture } from "./test/photo-fixture.js"

const bindings = new Set<LayoutBinding>(),
  mounts = new Set<ReturnType<typeof mountPrivateLayout>>(),
  hosts = new Set<HTMLElement>()
afterEach(() => {
  for (const mount of mounts) mount.unmount()
  for (const binding of bindings) {
    binding.engine._tiptapEditor.destroy()
    binding.doc.destroy()
  }
  for (const host of hosts) host.remove()
  mounts.clear()
  bindings.clear()
  hosts.clear()
})
function value<T>(result: Result<T>): T {
  if (result.kind === "refused") throw new Error(result.reason)
  return result.value
}
function setup() {
  const binding = value(createPrivateLayout(photoLayoutFixture())),
    host = document.createElement("div")
  document.body.append(host)
  bindings.add(binding)
  hosts.add(host)
  const mount = mountPrivateLayout(
    binding,
    host,
    (source) => `/owned/${source.slice(5)}`
  )
  mounts.add(mount)
  return { binding, host, mount }
}
describe("mounted photo geometry on the owned fragment", () => {
  it("renders owned source, crop, rounded shape, rotated frame and wrapping bounds", () => {
    const { host } = setup(),
      photo = photoFixture(),
      bounds = photoBounds(photo)
    const figure = host.querySelector<HTMLElement>(
        "[data-paper-photo='portrait']"
      ),
      frame = figure?.firstElementChild,
      image = figure?.querySelector("img")
    expect(figure?.style.width).toBe(
      `${(bounds.width + photo.spacing.left + photo.spacing.right) / 20}pt`
    )
    expect(figure?.style.cssFloat).toBe("right")
    expect(frame instanceof HTMLElement && frame.style.transform).toBe(
      "rotate(30deg)"
    )
    expect(frame instanceof HTMLElement && frame.style.borderRadius).toBe(
      "12pt"
    )
    expect(image?.getAttribute("src")).toBe(
      "/owned/00000000-0000-4000-8000-000000000001"
    )
    expect(image?.alt).toBe("Linh at work")
    expect(image?.style.width).toBe(`${10000000 / 70000}%`)
  })
  it("updates the mounted photo from a durable command and rejects direct unreceipted mutation", () => {
    const { binding, host, mount } = setup()
    value(
      commitLayoutPhotoEdit(
        binding,
        "circle",
        {
          kind: "update-photo",
          photo: {
            ...photoFixture(),
            width: 1440,
            height: 1440,
            shape: "circle",
            rotation: 0,
          },
        },
        canonical(readLayout(binding))
      )
    )
    expect(
      host.querySelector<HTMLElement>("[data-paper-photo='portrait'] > div")
        ?.style.borderRadius
    ).toBe("50%")
    const before = readLayout(binding)
    mount.editor.updateBlock("portrait", {
      props: { photo: canonical({ ...photoFixture(), alt: "Unreceipted" }) },
    })
    expect(readLayout(binding)).toEqual(before)
  })
})

describe("rich CV and Letter photo editing", () => {
  beforeAll(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      }
    )
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { ready: Promise.resolve() },
    })
  })
  afterAll(() => {
    vi.unstubAllGlobals()
    Reflect.deleteProperty(document, "fonts")
  })
  for (const kind of ["cv", "letter"] as const) {
    it(`persists ${kind} insert, resize, crop, shape, alignment, alt, replacement and removal through history and binary reload`, () => {
      const { version, schemaRevision, ...flow } = storedFlowFixture(kind)
      void version
      void schemaRevision
      const binding = value(createPrivateFlow(flow))
      const host = document.createElement("div")
      document.body.append(host)
      const mount = mountPrivateFlow(
        binding,
        host,
        (source) => `/owned/${source.slice(5)}`
      )
      const controls = flowPhotoControls(binding, mount)
      try {
        mount.editor.setTextCursorPosition("after", "end")
        const initial = readFlow(binding)
        const id = controls.insertPhoto(
          "file:00000000-0000-4000-8000-000000000002",
          2
        )
        const inserted = controls.photos().find((photo) => photo.id === id)
        expect(inserted).toMatchObject({ width: 2160, height: 1080 })
        controls.undoPhoto()
        expect(readFlow(binding)).toEqual(initial)
        controls.redoPhoto()
        expect(controls.photos()).toContainEqual(inserted)
        if (!inserted) throw new Error("Inserted photo missing")
        for (const shape of ["rectangle", "rounded", "circle"] as const) {
          const before = readFlow(binding)
          controls.updatePhoto({
            ...inserted,
            width: 1800,
            height: 1800,
            shape,
            crop: { top: 10000, right: 20000, bottom: 5000, left: 15000 },
            placement: { kind: "block", alignment: "right" },
            alt: "Portrait of Linh",
          })
          const after = readFlow(binding)
          expect(
            host
              .querySelector(`figure[data-paper-photo="${id}"] img`)
              ?.getAttribute("alt")
          ).toBe("Portrait of Linh")
          controls.undoPhoto()
          expect(readFlow(binding)).toEqual(before)
          controls.redoPhoto()
          expect(readFlow(binding)).toEqual(after)
          const reopened = openFlowBinary(
            Y.encodeStateAsUpdate(binding.doc),
            kind
          )
          try {
            expect(readFlow(reopened)).toEqual(after)
          } finally {
            reopened.engine._tiptapEditor.destroy()
            reopened.doc.destroy()
          }
        }
        const beforeReplace = readFlow(binding)
        controls.replacePhoto(id, "file:00000000-0000-4000-8000-000000000003")
        const replaced = readFlow(binding)
        controls.undoPhoto()
        expect(readFlow(binding)).toEqual(beforeReplace)
        controls.redoPhoto()
        expect(readFlow(binding)).toEqual(replaced)
        controls.removePhoto(id)
        expect(controls.photos().some((photo) => photo.id === id)).toBe(false)
        controls.undoPhoto()
        expect(readFlow(binding)).toEqual(replaced)
        controls.redoPhoto()
        expect(controls.photos().some((photo) => photo.id === id)).toBe(false)
      } finally {
        mount.unmount()
        binding.engine._tiptapEditor.destroy()
        binding.doc.destroy()
        host.remove()
      }
    })
  }
})
