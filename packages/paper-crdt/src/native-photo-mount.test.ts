import * as Y from "yjs"
import { NodeSelection } from "@tiptap/pm/state"
import {
  createPrivateFlow,
  readFlow,
  openFlowBinary,
} from "./native-layout-flow.js"
import { mountPrivateFlow } from "./native-layout-flow-mount.js"
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
  flowSectionSchema,
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
    const radii =
      frame instanceof HTMLElement
        ? frame.style.borderRadius.split(" / ").map(Number.parseFloat)
        : []
    expect(radii[0]).toBeCloseTo(100 / 6)
    expect(radii[1]).toBeCloseTo((1440 / (6 * 1800)) * 100)
    expect(image?.getAttribute("src")).toBe(
      "/owned/00000000-0000-4000-8000-000000000001"
    )
    expect(image?.alt).toBe("Linh at work")
    expect(image?.style.width).toBe(`${10000000 / 70000}%`)
  })
  it("keeps the photo, rotated bounds and spacing proportional inside a narrow column without changing saved geometry", () => {
    const { binding, host } = setup(),
      before = canonical(readLayout(binding)),
      photo = photoFixture(),
      bounds = photoBounds(photo),
      width = bounds.width + photo.spacing.left + photo.spacing.right,
      height = bounds.height + photo.spacing.top + photo.spacing.bottom,
      figure = host.querySelector<HTMLElement>("[data-paper-photo='portrait']"),
      outer = figure?.closest<HTMLElement>("[data-paper-photo-placement]"),
      frame = figure?.querySelector("div")
    expect(outer?.style.maxWidth).toBe("100%")
    expect(figure?.style.maxWidth).toBe("100%")
    expect(figure?.style.height).toBe("auto")
    expect(figure?.style.aspectRatio).toBe(`${width} / ${height}`)
    expect(frame?.style.width).toBe(`${(photo.width / width) * 100}%`)
    expect(frame?.style.height).toBe(`${(photo.height / height) * 100}%`)
    expect(frame?.style.left).toBe(
      `${(((bounds.width - photo.width) / 2 + photo.spacing.left) / width) * 100}%`
    )
    expect(frame?.style.top).toBe(
      `${(((bounds.height - photo.height) / 2 + photo.spacing.top) / height) * 100}%`
    )
    expect(canonical(readLayout(binding))).toBe(before)
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
    for (const later of [false, true]) {
      it(`inserts ${kind} at its ${later ? "later-section" : "first-section"} cell cursor with its column width`, () => {
        const { version, schemaRevision, ...flow } = storedFlowFixture(kind)
        void version
        void schemaRevision
        const first = flow.flow.children[0]!
        const table = first.children.find((node) => node.type === "table")
        if (!table) throw new Error("Missing fixture table")
        table.columns[0]!.width = 1200
        if (later) {
          first.children = first.children.filter((node) => node !== table)
          flow.flow.children.push(
            flowSectionSchema.parse({
              ...first,
              id: "later-section",
              start: "next-page",
              children: [
                table,
                {
                  id: "later-after",
                  type: "paragraph",
                  content: [],
                  paragraph: {},
                },
              ],
            })
          )
        }
        const binding = value(createPrivateFlow(flow))
        const host = document.createElement("div")
        document.body.append(host)
        const mount = mountPrivateFlow(binding, host)
        try {
          mount.editor.setTextCursorPosition("r1-a-p", "end")
          expect(mount.editor.getTextCursorPosition().block.id).toBe("r1-a-p")
          const before = readFlow(binding)
          for (const ratio of [1000, 0.001]) {
            expect(() =>
              mount.photoControls.insertPhoto(
                "file:00000000-0000-4000-8000-000000000002",
                ratio
              )
            ).toThrow(
              "This image is too wide or tall. Crop it closer to a square and try again."
            )
            expect(readFlow(binding)).toEqual(before)
          }
          const id = mount.photoControls.insertPhoto(
            "file:00000000-0000-4000-8000-000000000002",
            0.75
          )
          const after = readFlow(binding)
          const section = after.flow.children[later ? 1 : 0]!
          const updated = section.children.find((node) => node.type === "table")
          expect(
            updated?.children[0]?.children[0]?.children.map((node) => node.id)
          ).toEqual(["r1-a-p", id])
          expect(
            mount.photoControls.photos().find((photo) => photo.id === id)
          ).toMatchObject({ width: 960, height: 1280 })
          if (later)
            expect(after.flow.children[0]).toEqual(before.flow.children[0])
          mount.photoControls.undoPhoto()
          expect(readFlow(binding)).toEqual(before)
          mount.photoControls.redoPhoto()
          expect(readFlow(binding)).toEqual(after)
          const figure = host.querySelector<HTMLElement>(
            `[data-paper-photo="${id}"]`
          )
          figure?.click()
          expect(mount.photoControls.selectedPhoto()).toBe(id)
          expect(figure?.dataset.selected).toBe("true")
          expect(figure?.style.outline).toContain("2px")
          host
            .querySelector<HTMLElement>('[data-paper-photo="portrait"]')
            ?.click()
          expect(mount.photoControls.selectedPhoto()).toBe("portrait")
          expect(figure?.dataset.selected).toBe("false")
          const state = mount.editor.prosemirrorState
          let photoPosition = -1
          state.doc.descendants((node, position) => {
            if (
              node.type.name === "paperPhoto" &&
              node.attrs.photo.includes(id)
            )
              photoPosition = position
          })
          expect(photoPosition).toBeGreaterThan(-1)
          mount.editor.prosemirrorView.dispatch(
            state.tr.setSelection(
              NodeSelection.create(state.doc, photoPosition)
            )
          )
          mount.photoControls.removePhoto(id)
          expect(
            mount.photoControls.photos().some((photo) => photo.id === id)
          ).toBe(false)
          mount.photoControls.undoPhoto()
          expect(readFlow(binding)).toEqual(after)
          if (later) {
            mount.editor.setTextCursorPosition("later-after", "end")
            const next = mount.photoControls.insertPhoto(
              "file:00000000-0000-4000-8000-000000000002",
              0.75
            )
            expect(
              readFlow(binding).flow.children[1]?.children.at(-1)?.id
            ).toBe(next)
          }
          const cursor = mount.editor.getTextCursorPosition()
          const missing = vi
            .spyOn(mount.editor, "getTextCursorPosition")
            .mockReturnValue({
              ...cursor,
              block: { ...cursor.block, id: "missing-paragraph" },
            })
          const unchanged = readFlow(binding)
          expect(() =>
            mount.photoControls.insertPhoto(
              "file:00000000-0000-4000-8000-000000000002",
              0.75
            )
          ).toThrow("Place the cursor in the document")
          expect(readFlow(binding)).toEqual(unchanged)
          missing.mockRestore()
        } finally {
          mount.unmount()
          binding.engine._tiptapEditor.destroy()
          binding.doc.destroy()
          host.remove()
        }
      })
    }
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
      const controls = mount.photoControls
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
