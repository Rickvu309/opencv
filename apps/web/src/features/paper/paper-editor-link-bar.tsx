import { useReducer, type FC } from "react"
import { LinkToolbarExtension } from "@blocknote/core/extensions"
import {
  LinkToolbarController,
  useBlockNoteEditor,
  useExtension,
  type LinkToolbarProps,
} from "@blocknote/react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { normalizeHref } from "./link-href.ts"

type BarState = { editing: boolean; href: string }

type BarAction =
  | { type: "edit"; href: string }
  | { type: "type"; href: string }
  | { type: "done" }

function barReducer(state: BarState, action: BarAction): BarState {
  if (action.type === "edit") return { editing: true, href: action.href }
  if (action.type === "type") return { ...state, href: action.href }
  return { editing: false, href: "" }
}

const BAR_CLASS =
  "flex items-center gap-1 rounded-lg border bg-popover p-1 text-xs text-popover-foreground shadow-md"

const LinkBar: FC<LinkToolbarProps> = ({
  url,
  text,
  range,
  setToolbarOpen,
  setToolbarPositionFrozen,
}) => {
  const link = useExtension(LinkToolbarExtension)
  const [{ editing, href }, dispatch] = useReducer(barReducer, {
    editing: false,
    href: "",
  })
  const editor = useBlockNoteEditor()
  const next = normalizeHref(href)
  const finish = () => {
    dispatch({ type: "done" })
    setToolbarPositionFrozen?.(false)
  }
  const save = () => {
    if (next === null) return
    link.editLink(next, text, range.from)
    finish()
    setToolbarOpen?.(false)
    editor.focus()
  }
  const leave = () => {
    finish()
    setToolbarOpen?.(false)
    editor.focus()
  }
  if (editing) {
    return (
      <div role="toolbar" aria-label="Edit link" className={BAR_CLASS}>
        <Input
          aria-label="Link address"
          placeholder="https://"
          value={href}
          className="h-7 w-48"
          autoFocus
          onChange={(event) =>
            dispatch({ type: "type", href: event.target.value })
          }
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return
            if (event.key === "Enter") {
              event.preventDefault()
              save()
            } else if (event.key === "Escape") {
              event.preventDefault()
              event.stopPropagation()
              leave()
            }
          }}
        />
        <Button
          type="button"
          size="sm"
          className="h-7 text-xs"
          disabled={next === null}
          onClick={save}
        >
          Save
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={finish}
        >
          Cancel
        </Button>
      </div>
    )
  }
  return (
    <div role="toolbar" aria-label="Link" className={BAR_CLASS}>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="max-w-48 truncate px-1.5 underline"
      >
        {url}
      </a>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 text-xs"
        onClick={() => {
          setToolbarPositionFrozen?.(true)
          dispatch({ type: "edit", href: url })
        }}
      >
        Edit
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 text-xs"
        onClick={() => {
          link.deleteLink(range.from)
          setToolbarOpen?.(false)
        }}
      >
        Remove
      </Button>
    </div>
  )
}

export function PaperLinkToolbar() {
  return <LinkToolbarController linkToolbar={LinkBar} />
}
