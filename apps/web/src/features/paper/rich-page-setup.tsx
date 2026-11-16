import { useId, useReducer, type ReactNode } from "react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@workspace/ui/components/dialog"
import type { TextEditor } from "./rich-text-toolbar-control.tsx"

type Page = Parameters<TextEditor["setPageSetup"]>[0]
const sizes = { letter: [12240, 15840], a4: [11906, 16838] } satisfies Record<
  string,
  [number, number]
>
const margins = [
  { key: "top", label: "Top" },
  { key: "bottom", label: "Bottom" },
  { key: "start", label: "Left" },
  { key: "end", label: "Right" },
] as const

function PageSetupForm({
  editor,
  close,
}: {
  editor: TextEditor
  close: () => void
}) {
  const id = useId()
  const [page, update] = useReducer(
    (value: Page, patch: Partial<Page>) => ({ ...value, ...patch }),
    editor.pageSetup()
  )
  const [error, setError] = useReducer((_: string, value: string) => value, "")
  const size =
    Math.min(page.width, page.height) === sizes.a4[0] ? "a4" : "letter"
  const selectSize = (
    size: "letter" | "a4",
    orientation = page.orientation
  ) => {
    const [short, long] = sizes[size]
    update({
      width: orientation === "portrait" ? short : long,
      height: orientation === "portrait" ? long : short,
      orientation,
    })
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (
          page.start + page.end > page.width - 1440 ||
          page.top + page.bottom > page.height - 1440
        ) {
          setError("Reduce the margins to leave at least 1 inch for writing.")
          return
        }
        try {
          editor.setPageSetup(page)
          close()
        } catch {
          setError(
            "This setup leaves too little room for your content. Reduce the margins or choose a larger page."
          )
        }
      }}
      className="flex min-h-0 flex-col gap-5"
    >
      <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))] gap-4">
        <div className="grid gap-2">
          <Label htmlFor={`${id}-size`}>Paper size</Label>
          <select
            id={`${id}-size`}
            value={size}
            onChange={(event) =>
              selectSize(event.target.value === "a4" ? "a4" : "letter")
            }
            className="h-11 w-full rounded-md border border-input bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-ring"
          >
            <option value="letter">Letter</option>
            <option value="a4">A4</option>
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-orientation`}>Orientation</Label>
          <select
            id={`${id}-orientation`}
            value={page.orientation}
            onChange={(event) =>
              selectSize(
                size,
                event.target.value === "landscape" ? "landscape" : "portrait"
              )
            }
            className="h-11 w-full rounded-md border border-input bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-ring"
          >
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </select>
        </div>
      </div>
      <fieldset
        className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))] gap-4"
        aria-describedby={`${id}-hint`}
      >
        <legend className="mb-3 max-w-full text-sm font-medium">
          Margins (inches)
        </legend>
        {margins.map(({ key, label }) => (
          <div key={key} className="grid gap-2">
            <Label htmlFor={`${id}-${key}`}>{label}</Label>
            <Input
              id={`${id}-${key}`}
              type="number"
              min="0"
              max="3"
              step="0.01"
              required
              defaultValue={page[key] / 1440}
              onChange={(event) =>
                update({ [key]: Math.round(event.target.valueAsNumber * 1440) })
              }
              className="h-11 text-base"
            />
          </div>
        ))}
      </fieldset>
      <p id={`${id}-hint`} className="text-sm text-muted-foreground">
        Use 0–3 inches. Applies to the whole document.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 md:min-h-8"
          onClick={close}
        >
          Cancel
        </Button>
        <Button type="submit" className="min-h-11 md:min-h-8">
          Apply
        </Button>
      </DialogFooter>
    </form>
  )
}

export function RichPageSetup({
  editor,
  children,
}: {
  editor: TextEditor | null
  children: (open: () => void) => ReactNode
}) {
  const [open, setOpen] = useReducer(
    (_: boolean, value: boolean) => value,
    false
  )
  return (
    <>
      {children(() => setOpen(true))}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent finalFocus={() => editor?.focus() ?? false}>
          <DialogHeader>
            <DialogTitle>Page setup</DialogTitle>
            <DialogDescription>
              Choose the paper and margins for your document and Word download.
            </DialogDescription>
          </DialogHeader>
          {open && editor ? (
            <PageSetupForm editor={editor} close={() => setOpen(false)} />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
