import { useId, useReducer, type ReactNode } from "react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
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
  initialPage,
  blocked,
}: {
  editor: TextEditor
  close: () => void
  initialPage: Page
  blocked: boolean
}) {
  const id = useId()
  const [page, update] = useReducer(
    (value: Page, patch: Partial<Page>) => ({ ...value, ...patch }),
    initialPage
  )
  const [error, setError] = useReducer((_: string, value: string) => value, "")
  const size =
    Object.entries(sizes).find(
      ([, [short, long]]) =>
        Math.min(page.width, page.height) === short &&
        Math.max(page.width, page.height) === long
    )?.[0] ?? "custom"
  const customLabel = `Custom (${(page.width / 1440).toFixed(2)} × ${(page.height / 1440).toFixed(2)} in)`
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
          if (blocked || !editor.apply(() => editor.setPageSetup(page))) {
            setError(
              "Paper is unavailable for editing. Reload the page and try again. Your document is kept."
            )
            return
          }
          close()
        } catch {
          setError(
            "Paper couldn't apply the page setup. Reload the page and try again. Your document is kept."
          )
        }
      }}
      className="flex min-h-0 min-w-0 flex-col gap-5"
    >
      <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))] gap-4">
        <div className="grid min-w-0 grid-cols-1 gap-2">
          <Label htmlFor={`${id}-size`}>Paper size</Label>
          <Select
            value={size}
            items={[
              { value: "letter", label: "Letter" },
              { value: "a4", label: "A4" },
              ...(size === "custom"
                ? [{ value: "custom", label: customLabel }]
                : []),
            ]}
            onValueChange={(value) =>
              selectSize(value === "a4" ? "a4" : "letter")
            }
          >
            <SelectTrigger
              id={`${id}-size`}
              className="w-full min-w-0 text-base data-[size=default]:h-11"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {size === "custom" ? (
                <SelectItem value="custom" disabled>
                  {customLabel}
                </SelectItem>
              ) : null}
              <SelectItem value="letter">Letter</SelectItem>
              <SelectItem value="a4">A4</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-2">
          <Label htmlFor={`${id}-orientation`}>Orientation</Label>
          <Select
            value={page.orientation}
            items={[
              { value: "portrait", label: "Portrait" },
              { value: "landscape", label: "Landscape" },
            ]}
            onValueChange={(value) => {
              const orientation =
                value === "landscape" ? "landscape" : "portrait"
              update({
                width:
                  orientation === "portrait"
                    ? Math.min(page.width, page.height)
                    : Math.max(page.width, page.height),
                height:
                  orientation === "portrait"
                    ? Math.max(page.width, page.height)
                    : Math.min(page.width, page.height),
                orientation,
              })
            }}
          >
            <SelectTrigger
              id={`${id}-orientation`}
              className="w-full min-w-0 text-base data-[size=default]:h-11"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="portrait">Portrait</SelectItem>
              <SelectItem value="landscape">Landscape</SelectItem>
            </SelectContent>
          </Select>
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
          <div key={key} className="grid min-w-0 grid-cols-1 gap-2">
            <Label htmlFor={`${id}-${key}`}>{label}</Label>
            <Input
              id={`${id}-${key}`}
              type="number"
              min="0"
              max="3"
              step="any"
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
          className="h-[44px] min-h-[44px] md:h-8 md:min-h-8"
          onClick={close}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={blocked}
          className="h-[44px] min-h-[44px] md:h-8 md:min-h-8"
        >
          Apply
        </Button>
      </DialogFooter>
    </form>
  )
}

export function RichPageSetup({
  editor,
  children,
  blocked = false,
}: {
  editor: TextEditor | null
  blocked?: boolean
  children: (open: () => void) => ReactNode
}) {
  const [open, setOpen] = useReducer(
    (_: boolean, value: boolean) => value,
    false
  )
  const [initialPage, setInitialPage] = useReducer(
    (_: Page | null, value: Page | null) => value,
    null
  )
  return (
    <>
      {children(() => {
        if (!editor || blocked) return
        editor.apply(() => {
          const page = editor.pageSetup()
          if (!page) return false
          setInitialPage(page)
          setOpen(true)
          return true
        })
      })}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent finalFocus={() => editor?.focus() ?? false}>
          <DialogHeader>
            <DialogTitle>Page setup</DialogTitle>
            <DialogDescription>
              Choose the paper and margins for your document and Word download.
            </DialogDescription>
          </DialogHeader>
          {open && editor && initialPage ? (
            <PageSetupForm
              editor={editor}
              initialPage={initialPage}
              blocked={blocked}
              close={() => setOpen(false)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
