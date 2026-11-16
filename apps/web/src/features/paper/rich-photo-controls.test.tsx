import type { ComponentProps } from "react"
import { afterEach, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import { layoutPhotoSchema } from "@workspace/domain/internal/paper-presentation"
import { RichPhotoControls } from "./rich-photo-controls.tsx"
import { photoErrorMessage } from "./rich-photo-error.ts"

afterEach(cleanup)

function setup() {
  const photo = layoutPhotoSchema.parse({
    id: "portrait",
    type: "photo",
    source: "file:00000000-0000-4000-8000-000000000001",
    width: 1800,
    height: 1800,
    crop: { top: 12500, right: 0, bottom: 12500, left: 0 },
    rotation: 0,
    shape: "circle",
    placement: { kind: "block", alignment: "left" },
    spacing: { top: 0, right: 0, bottom: 0, left: 0 },
    alt: "Portrait",
  })
  const editor = {
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
  } satisfies NonNullable<ComponentProps<typeof RichPhotoControls>["editor"]>
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
  return { editor, field }
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
