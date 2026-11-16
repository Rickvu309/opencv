import { useEffect, useReducer, useRef } from "react"
import { ImagePlus, Image, Undo2, Redo2 } from "lucide-react"
import { paperPhotoRef } from "@workspace/domain"
import { layoutPhotoSchema } from "@workspace/domain/internal/paper-presentation"
import type { mountRichPaperEditor } from "@workspace/paper-crdt/editor"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@workspace/ui/components/dialog"
import { resolvePhotoSrc } from "@/lib/requests.ts"
import { uploadPaperPhoto } from "./paper-api.ts"

type Editor = ReturnType<typeof mountRichPaperEditor>
type LayoutPhoto = ReturnType<Editor["photos"]>[number]
type State = {
  photo: LayoutPhoto | null
  busy: boolean
  error: string
  revision: number
}
type Action =
  | { type: "open"; photo: LayoutPhoto | null }
  | { type: "busy"; busy: boolean }
  | { type: "error"; error: string }
  | { type: "refresh" }
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "open":
      return { ...state, photo: action.photo, error: "" }
    case "busy":
      return {
        ...state,
        busy: action.busy,
        error: action.busy ? "" : state.error,
      }
    case "error":
      return { ...state, error: action.error }
    case "refresh":
      return { ...state, revision: state.revision + 1 }
  }
}
const edges = ["top", "right", "bottom", "left"] as const
const shapes = [
  { value: "rectangle", label: "Square corners" },
  { value: "rounded", label: "Rounded" },
  { value: "circle", label: "Circle" },
]
const alignments = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
]

export function RichPhotoControls({
  editor,
  disabled,
}: {
  editor: Editor | null
  disabled: boolean
}) {
  const [state, dispatch] = useReducer(reducer, {
    photo: null,
    busy: false,
    error: "",
    revision: 0,
  })
  const fileInput = useRef<HTMLInputElement>(null)
  const replacement = useRef<string | null>(null)
  const liveEditor = useRef(editor)
  useEffect(() => {
    liveEditor.current = editor
    return () => {
      liveEditor.current = null
    }
  }, [editor])
  useEffect(
    () => editor?.subscribe(() => dispatch({ type: "refresh" })),
    [editor]
  )
  const selected = state.photo
  const photos = editor?.photos() ?? []
  const history = editor?.photoHistory()
  const held = disabled || !editor || state.busy
  const fail = (error: unknown) =>
    dispatch({
      type: "error",
      error:
        error instanceof Error
          ? error.message
          : "Could not change the photo. Try again.",
    })
  const pick = (id: string | null) => {
    replacement.current = id
    fileInput.current?.click()
  }
  async function upload(file: File) {
    if (!editor) return
    dispatch({ type: "busy", busy: true })
    try {
      if (!["image/png", "image/jpeg", "image/gif"].includes(file.type))
        throw new Error("Choose a PNG, JPEG or GIF photo for Word.")
      const bitmap = await createImageBitmap(file)
      const ratio = bitmap.width / bitmap.height
      bitmap.close()
      const source = paperPhotoRef(await uploadPaperPhoto(file))
      if (liveEditor.current !== editor) return
      const id = replacement.current
      if (id) editor.replacePhoto(id, source)
      const photoId = id ?? editor.insertPhoto(source, ratio)
      dispatch({
        type: "open",
        photo: editor.photos().find((photo) => photo.id === photoId) ?? null,
      })
    } catch (error) {
      fail(error)
    } finally {
      dispatch({ type: "busy", busy: false })
    }
  }
  return (
    <>
      <input
        ref={fileInput}
        type="file"
        accept="image/png,image/jpeg,image/gif"
        aria-label="Photo file"
        className="hidden"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ""
          if (file) void upload(file)
        }}
      />
      <Button
        variant="ghost"
        size="icon"
        className="size-11 shrink-0 md:size-8"
        aria-label="Undo"
        disabled={held || !history?.undo}
        onClick={() => editor?.undoPhoto()}
      >
        <Undo2 />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-11 shrink-0 md:size-8"
        aria-label="Redo"
        disabled={held || !history?.redo}
        onClick={() => editor?.redoPhoto()}
      >
        <Redo2 />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-11 shrink-0 md:size-8"
        aria-label="Insert photo"
        disabled={held}
        onClick={() => pick(null)}
      >
        <ImagePlus />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-11 shrink-0 md:size-8"
        aria-label="Edit photo"
        disabled={held || photos.length === 0}
        onClick={() =>
          dispatch({ type: "open", photo: photos[photos.length - 1] ?? null })
        }
      >
        <Image />
      </Button>
      {state.busy ? (
        <span role="status" className="text-sm">
          Uploading photo…
        </span>
      ) : null}
      {!selected && state.error ? (
        <span role="alert" className="text-sm">
          {state.error}
        </span>
      ) : null}
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open && !state.busy) dispatch({ type: "open", photo: null })
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogTitle>Edit photo</DialogTitle>
          <DialogDescription>
            Size in pixels. Crop removes a percentage from each edge.
          </DialogDescription>
          {selected ? (
            <form
              key={selected.id + selected.source}
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault()
                if (!editor || held || !selected) return
                const data = new FormData(event.currentTarget)
                const shape = data.get("shape")
                const width = Math.round(Number(data.get("width")) * 15)
                const photo = layoutPhotoSchema.safeParse({
                  ...selected,
                  width,
                  height:
                    shape === "circle"
                      ? width
                      : Math.round(Number(data.get("height")) * 15),
                  shape,
                  placement: {
                    kind: "block",
                    alignment: data.get("alignment"),
                  },
                  alt: data.get("alt"),
                  crop: Object.fromEntries(
                    edges.map((edge) => [
                      edge,
                      Math.round(Number(data.get(edge)) * 1000),
                    ])
                  ),
                })
                if (!photo.success) {
                  fail(
                    new Error(
                      "Use a size of at least 16 pixels and keep some of the photo visible. A circle uses its width for both dimensions."
                    )
                  )
                  return
                }
                try {
                  editor.updatePhoto(photo.data)
                  dispatch({ type: "open", photo: null })
                } catch {
                  fail(
                    new Error(
                      "The photo must fit inside its page or table column. Reduce its width and try again."
                    )
                  )
                }
              }}
            >
              {photos.length > 1 ? (
                <label className="grid gap-1">
                  Photo
                  <Select
                    value={selected.id}
                    items={photos.map((photo, index) => ({
                      value: photo.id,
                      label: photo.alt || `Photo ${index + 1}`,
                    }))}
                    disabled={held}
                    onValueChange={(value) =>
                      dispatch({
                        type: "open",
                        photo:
                          photos.find((photo) => photo.id === value) ?? null,
                      })
                    }
                  >
                    <SelectTrigger
                      aria-label="Choose photo"
                      className="w-full data-[size=default]:h-11"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {photos.map((photo, index) => (
                        <SelectItem key={photo.id} value={photo.id}>
                          {photo.alt || `Photo ${index + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              ) : null}
              <img
                src={resolvePhotoSrc(selected.source)}
                alt={selected.alt || "Photo to edit"}
                className="mx-auto h-24 max-w-full object-contain"
              />
              <fieldset disabled={held} className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  {(["width", "height"] as const).map((dimension) => (
                    <label key={dimension} className="grid gap-1 capitalize">
                      {dimension}
                      <Input
                        name={dimension}
                        className="h-11 md:h-8"
                        type="number"
                        min="16"
                        max="2112"
                        step="1"
                        defaultValue={Math.round(selected[dimension] / 15)}
                        required
                      />
                    </label>
                  ))}
                </div>
                <fieldset className="grid grid-cols-2 gap-4">
                  <legend className="mb-2">Crop (%)</legend>
                  {edges.map((edge) => (
                    <label key={edge} className="grid gap-1 capitalize">
                      {edge}
                      <Input
                        name={edge}
                        className="h-11 md:h-8"
                        type="number"
                        min="0"
                        max="99.9"
                        step="0.1"
                        defaultValue={selected.crop[edge] / 1000}
                        required
                      />
                    </label>
                  ))}
                </fieldset>
                <div className="grid grid-cols-2 gap-4">
                  <label className="grid gap-1">
                    Shape
                    <Select
                      name="shape"
                      items={shapes}
                      disabled={held}
                      defaultValue={selected.shape}
                    >
                      <SelectTrigger
                        aria-label="Shape"
                        className="w-full data-[size=default]:h-11"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {shapes.map((shape) => (
                          <SelectItem key={shape.value} value={shape.value}>
                            {shape.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="grid gap-1">
                    Alignment
                    <Select
                      name="alignment"
                      items={alignments}
                      disabled={held}
                      defaultValue={
                        selected.placement.kind === "block"
                          ? selected.placement.alignment
                          : selected.placement.side
                      }
                    >
                      <SelectTrigger
                        aria-label="Alignment"
                        className="w-full data-[size=default]:h-11"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {alignments.map((alignment) => (
                          <SelectItem
                            key={alignment.value}
                            value={alignment.value}
                          >
                            {alignment.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                </div>
                <label className="grid gap-1">
                  Alternative text
                  <Input
                    name="alt"
                    className="h-11 md:h-8"
                    maxLength={
                      layoutPhotoSchema.shape.alt.maxLength ?? undefined
                    }
                    defaultValue={selected.alt}
                    placeholder="Describe the photo"
                  />
                </label>
                <p className="text-sm text-muted-foreground">
                  Circle uses the width for both dimensions.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button
                    className="h-11 md:h-8"
                    type="button"
                    variant="outline"
                    onClick={() => pick(selected.id)}
                  >
                    Replace photo
                  </Button>
                  <Button
                    className="h-11 md:h-8"
                    type="button"
                    variant="outline"
                    onClick={() => {
                      try {
                        editor?.removePhoto(selected.id)
                        dispatch({ type: "open", photo: null })
                      } catch (error) {
                        fail(error)
                      }
                    }}
                  >
                    Remove photo
                  </Button>
                </div>
              </fieldset>
              {state.error ? (
                <p role="alert" className="text-sm">
                  {state.error}
                </p>
              ) : null}
              <DialogFooter>
                <Button
                  className="h-11 md:h-8"
                  type="button"
                  variant="outline"
                  disabled={state.busy}
                  onClick={() => dispatch({ type: "open", photo: null })}
                >
                  Cancel
                </Button>
                <Button className="h-11 md:h-8" type="submit" disabled={held}>
                  Apply
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
