import type { ComponentProps } from "react"
import { afterEach, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import {
  nativeProvenance,
  richPaperDocumentSchema,
} from "@workspace/domain/paper-doc"
import { openRichPaperClient, seedStoredYDoc } from "@workspace/paper-crdt"
import { mountRichPaperEditor } from "@workspace/paper-crdt/editor"
import {
  croppedPhotoRatio,
  layoutPhotoSchema,
} from "@workspace/domain/internal/paper-presentation"
import { TooltipProvider } from "@workspace/ui/components/tooltip"
import { RichPhotoControls } from "./rich-photo-controls.tsx"
import { uploadPaperPhoto } from "../paper-api.ts"
import { parsePhotoForm, photoFields, photoNumbers } from "./rich-photo-form.ts"
import { photoErrorMessage } from "./rich-photo-form.ts"

vi.mock("../paper-api.ts", () => ({ uploadPaperPhoto: vi.fn() }))

const releases: (() => void)[] = []

afterEach(() => {
  cleanup()
  for (const release of releases.splice(0)) release()
  vi.unstubAllGlobals()
})

function setup(
  square = false,
  mounted = false,
  wrapped = false,
  portraitRatio = 0.75,
  size = 1800,
  shape: ReturnType<typeof layoutPhotoSchema.parse>["shape"] = square
    ? "rectangle"
    : "circle"
) {
  const photo = layoutPhotoSchema.parse({
    id: "portrait",
    type: "photo",
    source: "file:00000000-0000-4000-8000-000000000001",
    width: size,
    height:
      shape === "circle" || square ? size : Math.round(size / portraitRatio),
    crop: {
      top:
        square || shape !== "circle"
          ? 0
          : Math.round((1 - portraitRatio) * 50000),
      right: 0,
      bottom:
        square || shape !== "circle"
          ? 0
          : Math.round((1 - portraitRatio) * 50000),
      left: 0,
    },
    rotation: 0,
    shape,
    placement: wrapped
      ? { kind: "wrap", side: "right" }
      : { kind: "block", alignment: "left" },
    spacing: { top: 0, right: 0, bottom: 0, left: 0 },
    alt: "Portrait",
  })
  if (mounted) {
    const fonts = Object.getOwnPropertyDescriptor(document, "fonts")
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { ready: Promise.resolve() },
    })
    releases.push(() => {
      if (fonts) Object.defineProperty(document, "fonts", fonts)
      else Reflect.deleteProperty(document, "fonts")
    })
  }
  const client = mounted ? photoClient(photo) : null
  const host = document.createElement("div")
  if (client) document.body.append(host)
  const editor = client
    ? mountRichPaperEditor(client, host, { photoUrl: (id) => `/owned/${id}` })
    : ({
        focus: vi.fn((): false | HTMLElement => false),
        photos: () => [photo],
        subscribe: () => () => {},
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
      {(controls) => <TooltipProvider>{controls(() => {})}</TooltipProvider>}
    </RichPhotoControls>
  )
  fireEvent.click(screen.getByRole("button", { name: "Edit photo" }))
  const field = (name: string) =>
    within(screen.getByRole("dialog")).getByRole("textbox", {
      name: new RegExp(`^${name}$`, "i"),
    })
  return { editor, field, client, host }
}

it("keeps crop keystrokes until commit and permits each edge to return to zero", () => {
  const { field, editor } = setup()
  const top = field("Top")
  fireEvent.change(top, { target: { value: "" } })
  expect(top).toHaveValue("")
  fireEvent.change(top, { target: { value: "5" } })
  expect(top).toHaveValue("5")
  expect(field("Bottom")).toHaveValue("12.5")
  fireEvent.blur(top)
  expect(top).toHaveValue("5")
  expect(field("Bottom")).toHaveValue("20")
  for (const edge of ["Top", "Right", "Bottom", "Left"]) {
    fireEvent.change(field(edge), { target: { value: "0" } })
    fireEvent.blur(field(edge))
    expect(field(edge)).toHaveValue("0")
  }
  fireEvent.click(screen.getByRole("button", { name: "Apply" }))
  expect(editor.updatePhoto).toHaveBeenCalledOnce()
})

it("allows clearing and retyping sizes without appending the old value", () => {
  const { field } = setup()
  const width = field("Width")
  fireEvent.change(width, { target: { value: "" } })
  expect(width).toHaveValue("")
  fireEvent.change(width, { target: { value: "200" } })
  expect(width).toHaveValue("200")
  expect(field("Height")).toHaveValue("120")
  fireEvent.blur(width)
  expect(field("Width")).toHaveValue("200")
  expect(field("Height")).toHaveValue("200")
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

it("retains a refused crop and applies exactly the fields shown after recovery", () => {
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
      expect(field("Bottom")).toHaveValue("50")
      expect(field("Bottom")).toHaveAttribute("aria-invalid", "true")
      expect(field("Bottom")).toHaveAccessibleDescription(
        /Keep some of the photo visible/
      )
    }
  }
  expect(field("Top")).toHaveValue("10")
  expect(field("Bottom")).toHaveValue("50")
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Apply" }))
  const saved = client!.document()
  const section = saved!.flow.children[0]!
  expect(section.children.find((node) => node.type === "photo")).toMatchObject({
    crop: { top: 10000, bottom: 50000, left: 0, right: 0 },
    width: 1800,
    height: 720,
  })
  const figure = host.querySelector<HTMLElement>("figure[data-paper-photo]")!
  expect(figure.style.width).toBe("90pt")
  expect(figure.style.height).toBe("auto")
  expect(figure.style.aspectRatio).toBe("1800 / 720")
  expect(parseFloat(figure.querySelector("img")!.style.top)).toBeCloseTo(-25)
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
  [true, true],
  [true, false],
  [false, true],
  [false, false],
])(
  "refuses a direct Apply after invalid crop or width for rectangle=%s blur=%s",
  (rectangle, blur) => {
    const { field, client } = setup(rectangle, true)
    const before = client!.document()
    fireEvent.change(field("Top"), { target: { value: "60" } })
    fireEvent.blur(field("Top"))
    fireEvent.change(field("Bottom"), { target: { value: "50" } })
    if (blur) fireEvent.blur(field("Bottom"))
    fireEvent.click(screen.getByRole("button", { name: "Apply" }))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(field("Bottom")).toHaveValue("50")
    expect(field("Bottom")).toHaveAttribute("aria-invalid", "true")
    expect(field("Bottom")).toHaveAccessibleDescription(/Reduce Bottom/)
    expect(field("Top")).not.toHaveAttribute("aria-invalid", "true")
    expect(screen.getAllByText(/Keep some of the photo visible/)).toHaveLength(
      1
    )
    expect(field("Bottom")).toHaveFocus()
    expect(client!.document()).toEqual(before)
    fireEvent.change(field("Width"), { target: { value: "5" } })
    if (blur) fireEvent.blur(field("Width"))
    fireEvent.click(screen.getByRole("button", { name: "Apply" }))
    expect(field("Width")).toHaveValue("5")
    expect(field("Width")).toHaveAttribute("aria-invalid", "true")
    expect(field("Width")).toHaveAccessibleDescription("Use 16 to 2112 pixels.")
    expect(field("Width")).toHaveFocus()
    expect(client!.document()).toEqual(before)
  }
)

it.each([true, false])(
  "validates width on direct Apply without relying on blur for rectangle=%s",
  (rectangle) => {
    const { field, editor } = setup(rectangle)
    fireEvent.change(field("Width"), { target: { value: "2113" } })
    fireEvent.click(screen.getByRole("button", { name: "Apply" }))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(field("Width")).toHaveValue("2113")
    expect(field("Width")).toHaveFocus()
    expect(editor.updatePhoto).not.toHaveBeenCalled()
  }
)

it("validates every field together and preserves text on Enter", () => {
  const { field, editor } = setup(true)
  for (const name of ["Width", "Height", "Top", "Right", "Bottom", "Left"])
    fireEvent.change(field(name), { target: { value: "refused" } })
  fireEvent.keyDown(field("Width"), { key: "Enter" })
  fireEvent.click(screen.getByRole("button", { name: "Apply" }))
  for (const name of ["Width", "Height", "Top", "Right", "Bottom", "Left"]) {
    expect(field(name)).toHaveValue("refused")
    expect(field(name)).toHaveAttribute("aria-invalid", "true")
    expect(field(name)).toHaveAccessibleDescription(/Use/)
  }
  expect(field("Width")).toHaveFocus()
  expect(editor.updatePhoto).not.toHaveBeenCalled()
})

it.each([true, false])(
  "fits the final Circle crop after Claude's refused crop sequence, blur=%s",
  (blur) => {
    const { field, client } = setup(false, true, false, 2687 / 3356, 2700)
    fireEvent.change(field("Width"), { target: { value: "" } })
    fireEvent.blur(field("Width"))
    fireEvent.change(field("Top"), { target: { value: "30" } })
    fireEvent.blur(field("Top"))
    expect(field("Top")).toHaveValue("30")
    expect(field("Width")).toHaveValue("")
    fireEvent.change(field("Width"), { target: { value: "120" } })
    if (blur) fireEvent.blur(field("Width"))
    fireEvent.click(screen.getByRole("button", { name: "Apply" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    const photo = client!
      .document()!
      .flow.children.flatMap((section) => section.children)
      .find((node) => node.type === "photo")!
    expect(photo).toMatchObject({ shape: "circle", width: 1800, height: 1800 })
    if (photo.type !== "photo") throw new Error("Photo required")
    expect(croppedPhotoRatio(2687 / 3356, photo.crop)).toBeCloseTo(1, 4)
  }
)

it("keeps wrap placement and all untouched properties when applying", () => {
  const { editor, field } = setup(true, false, true)
  const original = editor.photos()[0]!
  fireEvent.change(field("Alternative text"), {
    target: { value: "Updated portrait" },
  })
  fireEvent.click(screen.getByRole("button", { name: "Apply" }))
  expect(editor.updatePhoto).toHaveBeenCalledExactlyOnceWith({
    ...original,
    alt: "Updated portrait",
  })
  expect(parsePhotoForm(original, photoFields(original))).toMatchObject({
    ok: true,
    photo: original,
  })
  expect(
    parsePhotoForm(original, { ...photoFields(original), alignment: "left" })
  ).toMatchObject({
    ok: true,
    photo: { placement: { kind: "block", alignment: "left" } },
  })
})

it.each([
  ["Top", "Bottom"],
  ["Bottom", "Top"],
])("ties one crop error to the last edited %s/%s field", (first, second) => {
  const { field, editor } = setup(true)
  fireEvent.change(field(first), { target: { value: "60" } })
  fireEvent.blur(field(first))
  fireEvent.change(field(second), { target: { value: "50" } })
  fireEvent.blur(field(second))
  fireEvent.click(screen.getByRole("button", { name: "Apply" }))
  expect(field(second)).toHaveAttribute("aria-invalid", "true")
  expect(field(first)).toHaveAttribute("aria-invalid", "false")
  expect(field(second)).toHaveFocus()
  expect(screen.getAllByText(/Keep some of the photo visible/)).toHaveLength(1)
  expect(editor.updatePhoto).not.toHaveBeenCalled()
})

it("refuses invalid seeded inputs and fits valid geometry", () => {
  let seed = 1584
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
  const examples = [
    "",
    " ",
    "-",
    "abc",
    "NaN",
    "Infinity",
    "-1",
    "5",
    "16",
    "120",
    "2112",
    "2113",
    "99.9999",
    "0",
    "50",
  ]
  const { editor } = setup(true)
  const original = editor.photos()[0]!
  for (let round = 0; round < 2000; round++) {
    const sourceRatio = [0.75, 1, 2][round % 3]!
    const sample = {
      ...original,
      height: Math.round(original.width / sourceRatio),
    }
    const fields = photoFields(sample)
    fields.shape = (["circle", "rounded", "rectangle"] as const)[round % 3]!
    fields.alignment = round % 2 ? "right" : "center"
    fields.alt = `Portrait ${round}`
    for (const name of photoNumbers) {
      if (random() < 0.5)
        fields[name] = examples[Math.floor(random() * examples.length)]!
      else
        fields[name] = String(
          Math.round(
            random() *
              (name === "width" || name === "height" ? 2200 : 110) *
              1000
          ) / 1000
        )
    }
    if (round % 10 === 0) {
      fields.width = fields.height = "120"
      fields.top = fields.bottom = fields.left = fields.right = "0"
    }
    const parsed = parsePhotoForm(sample, fields, sourceRatio)
    const validNumbers = photoNumbers.every((name) => {
      const n = Number(fields[name])
      return (
        fields[name].trim() &&
        Number.isFinite(n) &&
        n >= (name === "width" || name === "height" ? 16 : 0) &&
        n <= (name === "width" || name === "height" ? 2112 : 99.9)
      )
    })
    const valid = Boolean(
      validNumbers &&
      Math.round(Number(fields.top) * 1000) +
        Math.round(Number(fields.bottom) * 1000) <
        100000 &&
      Math.round(Number(fields.left) * 1000) +
        Math.round(Number(fields.right) * 1000) <
        100000
    )
    if (!valid) expect(parsed.ok).toBe(false)
    if (parsed.ok) {
      expect(layoutPhotoSchema.safeParse(parsed.photo).success).toBe(true)
      expect(parsed.photo.width).toBe(
        Math.round(Number(parsed.fields.width) * 15)
      )
      expect(parsed.photo.height).toBe(
        Math.round(Number(parsed.fields.height) * 15)
      )
      const ratio = croppedPhotoRatio(sourceRatio, parsed.photo.crop)
      if (parsed.photo.shape === "circle") {
        expect(parsed.photo.width).toBe(parsed.photo.height)
        expect(
          Math.abs(
            (100000 - parsed.photo.crop.left - parsed.photo.crop.right) *
              sourceRatio -
              (100000 - parsed.photo.crop.top - parsed.photo.crop.bottom)
          )
        ).toBeLessThanOrEqual(2)
      } else {
        expect(
          Math.abs(parsed.photo.height - parsed.photo.width / ratio)
        ).toBeLessThanOrEqual(0.5)
      }
      for (const edge of ["top", "right", "bottom", "left"] as const)
        expect(parsed.photo.crop[edge]).toBe(
          Math.round(Number(parsed.fields[edge]) * 1000)
        )
      expect(parsed.photo.shape).toBe(fields.shape)
      expect(parsed.photo.alt).toBe(fields.alt)
      expect(parsed.photo.placement).toEqual({
        kind: "block",
        alignment: fields.alignment,
      })
    }
  }
})

it.each([
  [2000, 100],
  [100, 20000],
])("refuses %s by %s photos before uploading bytes", async (width, height) => {
  setup()
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
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

it.each([
  ["rectangle", "Height", "253"],
  ["rounded", "Height", "253"],
  ["rectangle", "Top", "28.405"],
  ["circle", "Right", "3.496"],
  ["circle", "Left", "3.496"],
  ["circle", "Top", "11.362"],
] as const)(
  "reopens the shown %s fields after committing %s=%s",
  (shape, name, value) => {
    const { field, editor } = setup(
      false,
      true,
      false,
      2687 / 3356,
      2160,
      shape
    )
    expect(editor.photos()[0]?.shape).toBe(shape)
    const image = screen
      .getByRole("img", { name: "Photo preview: Portrait" })
      .querySelector("img")
    if (!image) throw new Error("Photo source required")
    Object.defineProperties(image, {
      naturalWidth: { value: 2687 },
      naturalHeight: { value: 3356 },
    })
    fireEvent.load(image)
    fireEvent.change(field(name), { target: { value } })
    fireEvent.blur(field(name))
    const shown = photoNumbers.map((key) => {
      const input = field(key)
      if (!(input instanceof HTMLInputElement))
        throw new Error("Photo field required")
      return input.value
    })
    fireEvent.blur(field(name))
    fireEvent.focus(field("Top"))
    fireEvent.blur(field("Top"))
    fireEvent.click(screen.getByRole("button", { name: "Apply" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(editor.photos()).toHaveLength(1)
    fireEvent.click(screen.getByRole("button", { name: "Edit photo" }))
    for (const [index, key] of photoNumbers.entries())
      expect(field(key)).toHaveValue(shown[index])
  }
)
