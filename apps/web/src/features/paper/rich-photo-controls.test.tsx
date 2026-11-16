import type { ComponentProps } from "react"
import { afterEach, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import { nativeProvenance, richPaperDocumentSchema } from "@workspace/domain"
import { openRichPaperClient, seedStoredYDoc } from "@workspace/paper-crdt"
import { mountRichPaperEditor } from "@workspace/paper-crdt/editor"
import { layoutPhotoSchema } from "@workspace/domain/internal/paper-presentation"
import { RichPhotoControls } from "./rich-photo-controls.tsx"
import { uploadPaperPhoto } from "./paper-api.ts"
import { photoErrorMessage } from "./rich-photo-error.ts"

vi.mock("./paper-api.ts", () => ({ uploadPaperPhoto: vi.fn() }))

const releases: (() => void)[] = []

afterEach(() => {
  cleanup()
  for (const release of releases.splice(0)) release()
  vi.unstubAllGlobals()
})

function setup(square = false, mounted = false) {
  const photo = layoutPhotoSchema.parse({
    id: "portrait",
    type: "photo",
    source: "file:00000000-0000-4000-8000-000000000001",
    width: 1800,
    height: 1800,
    crop: {
      top: square ? 0 : 12500,
      right: 0,
      bottom: square ? 0 : 12500,
      left: 0,
    },
    rotation: 0,
    shape: square ? "rectangle" : "circle",
    placement: { kind: "block", alignment: "left" },
    spacing: { top: 0, right: 0, bottom: 0, left: 0 },
    alt: "Portrait",
  })
  const client = mounted ? photoClient(photo) : null
  const host = document.createElement("div")
  if (client) document.body.append(host)
  const editor = client
    ? mountRichPaperEditor(client, host, { photoUrl: (id) => `/owned/${id}` })
    : ({
        photos: () => [photo],
        subscribe: () => () => {},
        photoHistory: () => ({ undo: false, redo: false }),
        undoPhoto: vi.fn(),
        redoPhoto: vi.fn(),
        insertPhoto: vi.fn(),
        replacePhoto: vi.fn(),
        selectedPhoto: () => photo.id,
        selectPhoto: vi.fn(),
        updatePhoto: vi.fn(),
        removePhoto: vi.fn(),
      } satisfies NonNullable<
        ComponentProps<typeof RichPhotoControls>["editor"]
      >)
  if (client)
    releases.push(() => {
      if ("destroy" in editor) editor.destroy()
      client.destroy()
      host.remove()
    })
  render(
    <RichPhotoControls editor={editor} disabled={false}>
      {null}
    </RichPhotoControls>
  )
  fireEvent.click(screen.getByRole("button", { name: "Edit photo" }))
  const field = (name: string) =>
    within(screen.getByRole("dialog")).getByRole("spinbutton", {
      name: new RegExp(name, "i"),
    })
  return { editor, field, client, host }
}

it("keeps crop keystrokes until commit and permits each edge to return to zero", () => {
  const { field, editor } = setup()
  const top = field("Top")
  fireEvent.change(top, { target: { value: "" } })
  expect(top).toHaveValue(null)
  fireEvent.change(top, { target: { value: "5" } })
  expect(top).toHaveValue(5)
  expect(field("Bottom")).toHaveValue(12.5)
  fireEvent.blur(top)
  expect(top).toHaveValue(5)
  expect(field("Bottom")).toHaveValue(20)
  for (const edge of ["Top", "Right", "Bottom", "Left"]) {
    fireEvent.change(field(edge), { target: { value: "0" } })
    fireEvent.blur(field(edge))
    expect(field(edge)).toHaveValue(0)
  }
  fireEvent.click(screen.getByRole("button", { name: "Apply", exact: true }))
  expect(editor.updatePhoto).toHaveBeenCalledOnce()
})

it("allows clearing and retyping sizes without appending the old value", () => {
  const { field } = setup()
  const width = field("Width")
  fireEvent.change(width, { target: { value: "" } })
  expect(width).toHaveValue(null)
  fireEvent.change(width, { target: { value: "200" } })
  expect(width).toHaveValue(200)
  expect(field("Height")).toHaveValue(120)
  fireEvent.blur(width)
  expect(field("Width")).toHaveValue(200)
  expect(field("Height")).toHaveValue(200)
})

it("explains geometry and available-space errors without schema output", () => {
  expect(photoErrorMessage(new Error("Photo exceeds its flow column"))).toBe(
    "This photo is wider than the space available. Reduce its width and try again."
  )
  const error = new Error("raw schema details")
  error.name = "ZodError"
  expect(photoErrorMessage(error)).toContain(
    "Use a smaller size or reduce the crop"
  )
  expect(
    photoErrorMessage(
      new Error(
        '[ { "code": "custom", "message": "Invalid flow content or semantic CV ownership", "path": [] } ]'
      )
    )
  ).toContain("Use a smaller size or reduce the crop")
})

it("resets a refused crop and applies exactly the fields shown after recovery", () => {
  const fonts = Object.getOwnPropertyDescriptor(document, "fonts")
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { ready: Promise.resolve() },
  })
  releases.push(() => {
    if (fonts) Object.defineProperty(document, "fonts", fonts)
    else Reflect.deleteProperty(document, "fonts")
  })
  const { field, client, host } = setup(true, true)
  for (const [name, value] of [
    ["Top", "60"],
    ["Bottom", "50"],
    ["Top", "10"],
  ]) {
    fireEvent.change(field(name), { target: { value } })
    fireEvent.blur(field(name))
    if (name === "Bottom") {
      expect(field("Bottom")).toHaveValue(0)
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Keep some of the photo visible"
      )
    }
  }
  expect(field("Top")).toHaveValue(10)
  expect(field("Bottom")).toHaveValue(0)
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Apply", exact: true }))
  const saved = client!.document()
  const section = saved!.flow.children[0]!
  expect(section.children.find((node) => node.type === "photo")).toMatchObject({
    crop: { top: 10000, bottom: 0, left: 0, right: 0 },
    width: 1800,
    height: 1620,
  })
  const figure = host.querySelector<HTMLElement>("figure[data-paper-photo]")!
  expect(figure.style.width).toBe("90pt")
  expect(figure.style.height).toBe("81pt")
  expect(parseFloat(figure.querySelector("img")!.style.top)).toBeCloseTo(
    -100 / 9
  )
  const stored = client!.stored()
  const recovered = openRichPaperClient(stored, {
    provenance: stored.provenance!,
  })
  try {
    expect(recovered.document()).toEqual(saved)
  } finally {
    recovered.destroy()
  }
})

it.each([
  [2000, 100],
  [100, 20000],
])("refuses %s by %s photos before uploading bytes", async (width, height) => {
  setup()
  fireEvent.click(screen.getByRole("button", { name: "Cancel", exact: true }))
  const close = vi.fn()
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn().mockResolvedValue({ width, height, close })
  )
  fireEvent.change(screen.getByLabelText("Photo file"), {
    target: {
      files: [new File(["image"], "extreme.png", { type: "image/png" })],
    },
  })
  expect(await screen.findByRole("alert")).toHaveTextContent("too wide or tall")
  expect(close).toHaveBeenCalledOnce()
  expect(uploadPaperPhoto).not.toHaveBeenCalled()
})

function photoClient(photo: ReturnType<typeof layoutPhotoSchema.parse>) {
  const page = {
    width: 11906,
    height: 16838,
    orientation: "portrait",
    top: 1440,
    bottom: 1440,
    start: 1440,
    end: 1440,
  }
  const document = richPaperDocumentSchema.parse({
    version: 4,
    schemaRevision: 2,
    profile: "private-layout-3",
    kind: "letter",
    presentation: {
      codecVersion: 1,
      page,
      inline: {},
      paragraph: {},
      styles: [],
    },
    flow: {
      id: "flow",
      type: "flow",
      children: [
        {
          id: "section",
          type: "flowSection",
          start: "continuous",
          page,
          columns: { count: 1, gap: 360 },
          children: [
            {
              id: "intro",
              type: "paragraph",
              paragraph: {},
              content: [{ text: "Portrait" }],
            },
            photo,
          ],
        },
      ],
    },
  })
  const provenance = nativeProvenance(document)
  return openRichPaperClient(
    {
      epoch: 1,
      revision: 0,
      provenance,
      server: seedStoredYDoc(document),
      pending: new Uint8Array([0, 0]),
    },
    { provenance }
  )
}
