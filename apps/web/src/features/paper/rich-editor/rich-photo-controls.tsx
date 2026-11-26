import { useEffect, useReducer, useRef, type ReactNode } from "react"
import { paperPhotoRef } from "@workspace/domain/paper-doc"
import {
  layoutPhotoSchema,
  photoSourceRatio,
  photoInsertSize,
} from "@workspace/domain/internal/paper-presentation"
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@workspace/ui/components/dialog"
import { RichPhotoToolbar } from "./rich-document-toolbar.tsx"
import { RichPhotoChoice } from "./rich-photo-choice.tsx"
import { RichPhotoNumber } from "./rich-photo-number.tsx"
import { RichPhotoPreview } from "./rich-photo-preview.tsx"
import {
  photoErrorMessage,
  parsePhotoForm,
  photoNumbers,
  photoFields,
  type PhotoErrors,
  type PhotoFields,
  type PhotoNumber,
} from "./rich-photo-form.ts"
import { uploadPaperPhoto } from "../paper-api.ts"

type Editor = ReturnType<typeof mountRichPaperEditor>
type LayoutPhoto = ReturnType<Editor["photos"]>[number]
type State = {
  photo: LayoutPhoto | null
  fields: PhotoFields | null
  errors: PhotoErrors
  busy: boolean
  error: string
  revision: number
}
type Action =
  | { type: "open"; photo: LayoutPhoto | null }
  | { type: "busy"; busy: boolean }
  | { type: "error"; error: string }
  | { type: "refresh" }
  | { type: "fields"; fields: PhotoFields; errors?: PhotoErrors }
  | { type: "validate"; errors: PhotoErrors }
function photoDraft(state: State, action: Action): State {
  switch (action.type) {
    case "open":
      return {
        ...state,
        photo: action.photo,
        fields: action.photo ? photoFields(action.photo) : null,
        errors: {},
        error: "",
      }
    case "busy":
      return {
        ...state,
        busy: action.busy,
        error: action.busy ? "" : state.error,
      }
    case "error":
      return { ...state, error: action.error }
    case "fields":
      return {
        ...state,
        fields: action.fields,
        errors: action.errors ?? {},
        error: "",
      }
    case "validate":
      return { ...state, errors: action.errors }
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
  children,
}: {
  editor: Pick<
    Editor,
    | "focus"
    | "photos"
    | "subscribe"
    | "insertPhoto"
    | "replacePhoto"
    | "selectedPhoto"
    | "selectPhoto"
    | "updatePhoto"
    | "removePhoto"
  > | null
  disabled: boolean
  children: (controls: (onAction: () => void) => ReactNode) => ReactNode
}) {
  const [state, dispatch] = useReducer(photoDraft, {
    photo: null,
    fields: null,
    errors: {},
    busy: false,
    error: "",
    revision: 0,
  })
  const fileInput = useRef<HTMLInputElement>(null)
  const replacement = useRef<string | null>(null)
  const liveEditor = useRef(editor)
  const sourceRatios = useRef(new Map<string, number>())
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
  const fields = state.fields
  const parsed = selected && fields ? parsePhotoForm(selected, fields) : null
  const setFields = (next: PhotoFields, field?: PhotoNumber) => {
    if (!selected) return
    const sourceRatio =
      sourceRatios.current.get(selected.source) ?? photoSourceRatio(selected)
    const result = parsePhotoForm(selected, next, sourceRatio, field)
    dispatch({
      type: "fields",
      fields: next,
      errors:
        Object.keys(state.errors).length && !result.ok ? result.errors : {},
    })
  }
  const commitField = (field: PhotoNumber | "shape", next = fields) => {
    if (!selected || !next) return
    const sourceRatio =
      sourceRatios.current.get(selected.source) ?? photoSourceRatio(selected)
    const result = parsePhotoForm(selected, next, sourceRatio, field)
    if (!result.ok) {
      dispatch({ type: "fields", fields: next, errors: result.errors })
      return
    }
    const validated = parsePhotoForm(selected, result.fields, sourceRatio)
    dispatch({
      type: "fields",
      fields: result.fields,
      errors: validated.ok ? {} : validated.errors,
    })
  }
  const photos = editor?.photos() ?? []
  const held = disabled || !editor || state.busy
  const fail = (error: unknown) =>
    dispatch({
      type: "error",
      error: photoErrorMessage(error),
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
      const bitmap = await createImageBitmap(file).catch(() => {
        throw new Error("This image could not be read. Choose another photo.")
      })
      const ratio = bitmap.width / bitmap.height
      bitmap.close()
      photoInsertSize(ratio)
      const source = paperPhotoRef(await uploadPaperPhoto(file))
      if (liveEditor.current !== editor) return
      const id = replacement.current
      sourceRatios.current.set(source, ratio)
      if (id) editor.replacePhoto(id, source, ratio)
      const photoId = id ?? editor.insertPhoto(source, ratio)
      editor.selectPhoto(photoId)
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
      <Input
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
      {children((onAction) => (
        <RichPhotoToolbar
          held={held}
          hasPhotos={photos.length > 0}
          onInsert={() => {
            pick(null)
            onAction()
          }}
          onEdit={() => {
            onAction()
            dispatch({
              type: "open",
              photo:
                photos.find((photo) => photo.id === editor?.selectedPhoto()) ??
                photos[0] ??
                null,
            })
          }}
        />
      ))}
      <div
        role="status"
        className={
          state.busy ? "px-4 py-2 text-sm text-muted-foreground" : "sr-only"
        }
      >
        {state.busy ? "Uploading photo…" : ""}
      </div>
      {!selected && state.error ? (
        <p role="alert" className="px-4 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open && !state.busy) dispatch({ type: "open", photo: null })
        }}
      >
        <DialogContent
          finalFocus={() => editor?.focus() ?? false}
          className="flex flex-col overflow-hidden p-0 sm:max-w-md [&_[data-slot=dialog-close-pin]]:absolute [&_[data-slot=dialog-close-pin]]:right-6"
        >
          <DialogHeader className="shrink-0 px-6 pt-6">
            <DialogTitle>Edit photo</DialogTitle>
            <DialogDescription>
              Size in pixels. Crop removes a percentage from each edge.
            </DialogDescription>
          </DialogHeader>
          {selected && fields ? (
            <form
              noValidate
              key={selected.id + selected.source}
              className="flex min-h-0 flex-col overflow-hidden"
              onSubmit={(event) => {
                event.preventDefault()
                if (!editor || held || !selected) return
                const current = editor
                  .photos()
                  .find((photo) => photo.id === selected.id)
                if (!current) {
                  fail(
                    new Error("This photo was removed. Choose another photo.")
                  )
                  return
                }
                if (current.source !== selected.source) {
                  fail(
                    new Error(
                      "This photo was replaced. Reopen it before applying changes."
                    )
                  )
                  return
                }
                const sourceRatio =
                  sourceRatios.current.get(current.source) ??
                  photoSourceRatio(current)
                const photo = parsePhotoForm(
                  current,
                  fields,
                  sourceRatio,
                  edges.find((edge) => state.errors[edge])
                )
                if (!photo.ok) {
                  dispatch({ type: "validate", errors: photo.errors })
                  const first = [...photoNumbers, "alt"].find(
                    (name) => name in photo.errors
                  )
                  if (first)
                    event.currentTarget
                      .querySelector<HTMLInputElement>(`[name="${first}"]`)
                      ?.focus()
                  return
                }
                try {
                  editor.updatePhoto(photo.photo)
                  dispatch({ type: "open", photo: null })
                } catch (error) {
                  fail(error)
                }
              }}
            >
              <div className="grid min-h-0 grid-cols-1 gap-4 overflow-y-auto overscroll-contain px-6 pb-4">
                <RichPhotoChoice
                  photos={photos}
                  selectedId={selected.id}
                  disabled={held}
                  onChoose={(value) =>
                    dispatch({
                      type: "open",
                      photo: photos.find((photo) => photo.id === value) ?? null,
                    })
                  }
                />
                <RichPhotoPreview
                  selected={parsed?.ok ? parsed.photo : selected}
                  onSourceRatio={(ratio) =>
                    sourceRatios.current.set(selected.source, ratio)
                  }
                />
                <fieldset disabled={held} className="grid min-w-0 gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    {(["width", "height"] as const).map((dimension) => (
                      <label
                        key={dimension}
                        className="grid content-start gap-1"
                      >
                        {dimension === "width" ? "Width" : "Height"}
                        <RichPhotoNumber
                          name={dimension}
                          value={fields[dimension]}
                          error={state.errors[dimension]}
                          onChange={(value) =>
                            setFields({ ...fields, [dimension]: value })
                          }
                          onCommit={() => commitField(dimension)}
                        />
                      </label>
                    ))}
                  </div>
                  <fieldset className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <legend className="mb-2">Crop (%)</legend>
                    {edges.map((edge) => (
                      <label key={edge} className="grid content-start gap-1">
                        {edge[0].toUpperCase() + edge.slice(1)}
                        <RichPhotoNumber
                          name={edge}
                          value={fields[edge]}
                          error={state.errors[edge]}
                          onChange={(value) =>
                            setFields({ ...fields, [edge]: value }, edge)
                          }
                          onCommit={() => commitField(edge)}
                        />
                      </label>
                    ))}
                  </fieldset>
                  <div className="grid grid-cols-2 gap-4">
                    <label className="grid min-w-0 gap-1">
                      Shape
                      <Select
                        name="shape"
                        items={shapes}
                        disabled={held}
                        value={fields.shape}
                        onValueChange={(value) => {
                          if (
                            value === "circle" ||
                            value === "rectangle" ||
                            value === "rounded"
                          )
                            commitField("shape", { ...fields, shape: value })
                        }}
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
                    <label className="grid min-w-0 gap-1">
                      Alignment
                      <Select
                        name="alignment"
                        items={alignments}
                        disabled={held}
                        value={fields.alignment}
                        onValueChange={(value) => {
                          if (
                            value === "left" ||
                            value === "center" ||
                            value === "right"
                          )
                            setFields({ ...fields, alignment: value })
                        }}
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
                  <label className="grid min-w-0 gap-1">
                    Alternative text
                    <Input
                      name="alt"
                      aria-label="Alternative text"
                      className="h-11 md:h-8"
                      maxLength={
                        layoutPhotoSchema.shape.alt.maxLength ?? undefined
                      }
                      value={fields.alt}
                      aria-invalid={Boolean(state.errors.alt)}
                      aria-describedby={
                        state.errors.alt ? "photo-alt-error" : undefined
                      }
                      onChange={(event) =>
                        setFields({ ...fields, alt: event.currentTarget.value })
                      }
                      placeholder="Describe the photo"
                    />
                    {state.errors.alt ? (
                      <span
                        id="photo-alt-error"
                        className="text-sm text-destructive"
                      >
                        {state.errors.alt}
                      </span>
                    ) : null}
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Proportions stay locked. Circle keeps a square crop.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      size="touch"
                      type="button"
                      variant="outline"
                      onClick={() => pick(selected.id)}
                    >
                      Replace photo
                    </Button>
                    <Button
                      size="touch"
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
              </div>
              <DialogFooter className="sticky bottom-0 mx-0 mb-0 shrink-0 border-t bg-popover px-6 py-4">
                <div className="grid w-full gap-3">
                  {state.error ? (
                    <p role="alert" className="text-sm text-destructive">
                      {state.error}
                    </p>
                  ) : null}
                  <div className="flex justify-end gap-2">
                    <Button
                      size="touch"
                      type="button"
                      variant="outline"
                      disabled={state.busy}
                      onClick={() => dispatch({ type: "open", photo: null })}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="touch"
                      variant="primary"
                      type="submit"
                      disabled={held}
                    >
                      Apply
                    </Button>
                  </div>
                </div>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
