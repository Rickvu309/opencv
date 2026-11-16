export const clean = [
  {
    path: "apps/web/src/features/paper/rich-photo-form.ts",
    text: 'function parsePhotoForm() { const crop = photo.shape === "circle" ? fitPhotoCrop(sourceRatio, 1, photo.crop) : photo.crop; return { ...photo, crop, placement: original.placement, width: Math.round((photo.width / 15) * 100) } }',
  },
  {
    path: "apps/web/src/features/paper/rich-photo-controls.tsx",
    text: "<form onSubmit={() => { const photo = parsePhotoForm(current, fields); if (!photo.ok) { input.focus(); return }; editor.updatePhoto(photo.photo) }} />",
  },
  {
    path: "apps/web/src/features/paper/rich-photo-controls.tsx",
    text: "photoInsertSize(ratio); uploadPaperPhoto(file)",
  },
  {
    path: "packages/domain/src/paper-doc/native-photo-geometry.ts",
    text: "function fitEditedCrop() { return 99900 - crop[editedEdge] }",
  },
  {
    path: "packages/paper-crdt/src/native-layout-photo-controls.ts",
    text: "const { width, height } = photoInsertSize(aspectRatio, available); layoutPhotoSchema.parse({ width, height })",
  },
  {
    path: "apps/web/src/features/paper/rich-photo-error.ts",
    text: 'if (error.message.trimStart().startsWith("[")) return "Use a smaller size"',
  },
  {
    path: "apps/web/src/features/paper/rich-photo-number.tsx",
    text: `const field = <Input value={value} className="tabular-nums" aria-invalid={Boolean(error)} aria-describedby={errorId} onChange={event => onChange(event.target.value)} onBlur={onCommit} />`,
  },
  {
    path: "apps/web/src/features/paper/rich-photo-controls.tsx",
    text: "<RichPhotoNumber onCommit={(value) => fitPhotoCrop(ratio, 1, crop, edge)} />",
  },
  {
    path: "packages/paper-crdt/src/native-layout-photo-controls.ts",
    text: 'if (width < 240 || Math.round(width / aspectRatio) < 240) throw new Error("Crop this image and try again"); layoutPhotoSchema.parse({})',
  },
  {
    path: "packages/domain/src/paper-doc/native-layout-photo-destination.ts",
    text: 'throw new Error("Place the cursor in the document before inserting a photo")',
  },
  {
    path: "apps/web/src/features/paper/rich-photo-preview.tsx",
    text: '<div role="img"><img alt="" style={{left: selected.crop.left, top: selected.crop.top, borderRadius: Math.min(width, height) / 6}} /></div>',
  },
  {
    path: "packages/paper-crdt/src/native-layout-photo-controls.ts",
    text: 'TextSelection.findFrom(state.selection.$from, -1, true); change({ kind: "remove-photo", photoId })',
  },
  {
    path: "apps/web/src/features/paper/rich-photo-controls.tsx",
    text: '<Input name={edge} step="any" />',
  },
  {
    path: "packages/paper-crdt/src/native-layout-photo-controls.ts",
    text: "const destination = photoDestination(document, cursor)",
  },
  {
    path: "apps/web/src/features/paper/rich-photo-controls.tsx",
    text: "resizePhoto(selected, dimension, value, sourceRatio); selected.crop.left; selected.shape === 'circle'; editor.selectedPhoto()",
  },
  {
    path: "apps/api/src/paper/native-output/formatted-photos.ts",
    text: 'const bounds = photoBounds(photo); const frame = `<wp:extent cx="${boundWidth}" cy="${boundHeight}"/>`',
  },
  {
    path: "packages/paper-crdt/src/native-photo.ts",
    text: 'import { layoutDocumentSchema } from "@workspace/domain/internal/paper-presentation"',
  },
]

export const mistakes = [
  {
    path: "apps/web/src/features/paper/rich-photo-form.ts",
    text: "function parsePhotoForm() { if (commit) { const crop = fitPhotoCrop(sourceRatio, 1, photo.crop); } return layoutPhotoSchema.safeParse(photo) }",
  },
  {
    path: "apps/web/src/features/paper/rich-photo-controls.tsx",
    text: "<form onSubmit={() => { const photo = layoutPhotoSchema.safeParse(selected); editor.updatePhoto(photo.data) }} />",
  },
  {
    path: "apps/web/src/features/paper/rich-photo-number.tsx",
    text: 'const [draft, dispatch] = useReducer(numberDraft, String(value)); <Input className="tabular-nums" aria-invalid={error} aria-describedby={errorId} />',
  },
  {
    path: "apps/web/src/features/paper/rich-photo-controls.tsx",
    text: "uploadPaperPhoto(file); photoInsertSize(ratio)",
  },
  {
    path: "apps/web/src/features/paper/rich-photo-number.tsx",
    text: "onCommit(Number(draft))",
  },
  {
    path: "packages/domain/src/paper-doc/native-photo-geometry.ts",
    text: "function fitEditedCrop() { return Math.min(99999, crop[edge]) }",
  },
  {
    path: "apps/web/src/features/paper/rich-photo-error.ts",
    text: 'if (error.name === "ZodError") return "Use a smaller size"; return error.message',
  },
  {
    path: "apps/web/src/features/paper/rich-photo-number.tsx",
    text: `const change = (event) => onCommit(Number(event.target.value) || 1)`,
  },
  {
    path: "apps/web/src/features/paper/rich-photo-controls.tsx",
    text: "<Input onChange={(event) => fitPhotoCrop(ratio, 1, crop)} />",
  },
  {
    path: "apps/web/src/features/paper/rich-photo-controls.tsx",
    text: "<Input onChange={(event) => resizePhoto(selected, dimension, event.target.value, ratio)} />",
  },
  {
    path: "apps/web/src/features/paper/rich-photo-controls.tsx",
    text: "<DialogContent><DialogTitle>Edit photo</DialogTitle><DialogFooter><Button>Apply</Button></DialogFooter></DialogContent>",
  },
  {
    path: "apps/web/src/features/paper/rich-photo-controls.tsx",
    text: "fail(error.message)",
  },
  {
    path: "packages/paper-crdt/src/native-layout-photo-controls.ts",
    text: "layoutPhotoSchema.parse({ width, height: Math.round(width / aspectRatio) })",
  },
  {
    path: "apps/web/src/features/paper/rich-photo-preview.tsx",
    text: "<img style={{ insetInlineStart: crop.left, borderRadius: previewWidth / 6 }} />",
  },
  {
    path: "packages/domain/src/paper-doc/native-layout-photo-destination.ts",
    text: "const section = document.flow.children.find(match) ?? document.flow.children[0]",
  },
  {
    path: "apps/web/src/features/paper/rich-photo-preview.tsx",
    text: '<img alt={selected.alt || "Photo to edit"} />',
  },
  {
    path: "packages/paper-crdt/src/native-layout-photo-controls.ts",
    text: 'removePhoto(photoId: string) { change({ kind: "remove-photo", photoId }) }',
  },
  {
    path: "apps/web/src/features/paper/rich-photo-controls.tsx",
    text: '<Input name={edge} step="0.1" />',
  },
  {
    path: "packages/paper-crdt/src/native-layout-photo-controls.ts",
    text: "const section = document.flow.children.find(match) ?? document.flow.children[0]",
  },
  {
    path: "packages/paper-crdt/src/native-layout-photo-controls.ts",
    text: "const destination = { afterId: anchor?.id ?? null }",
  },
  {
    path: "apps/web/src/features/paper/rich-photo-controls.tsx",
    text: "const photo = photos[photos.length - 1]",
  },
  {
    path: "apps/web/src/features/paper/rich-photo-controls.tsx",
    text: 'const width = data.get("width"), height = data.get("height")',
  },
  {
    path: "apps/web/src/features/paper/rich-photo-controls.tsx",
    text: '<img alt={selected.alt || "Photo to edit"} />',
  },
  {
    path: "apps/api/src/paper/native-output/formatted-photos.ts",
    text: 'const frame = `<wp:extent cx="${width}" cy="${height}"/>`',
  },
  {
    path: "apps/web/src/features/paper/photos.ts",
    text: 'import { mountPrivateLayout } from "@workspace/paper-crdt/native-photo-mount"',
  },
]
