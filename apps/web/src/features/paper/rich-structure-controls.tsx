import { useEffect, useReducer, type ReactNode } from "react"
import type { mountRichPaperEditor } from "@workspace/paper-crdt/editor"
import { Button } from "@workspace/ui/components/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { List, ListOrdered, Link, RemoveFormatting } from "lucide-react"

import { ToolbarHint } from "./rich-text-toolbar-control.tsx"

import { ToolbarItem } from "./rich-text-toolbar-item.tsx"

type Editor = ReturnType<typeof mountRichPaperEditor>
export function RichStructureControls({
  editor,
  blocked,
  children,
  compact = false,
}: {
  editor: Editor | null
  blocked: boolean
  compact?: boolean
  children:
    | ReactNode
    | ((slots: {
        style: ReactNode
        controls: ReactNode
        link: ReactNode
        lists: ReactNode
      }) => ReactNode)
}) {
  const [, refresh] = useReducer((value: number) => value + 1, 0)
  useEffect(() => editor?.subscribe(refresh), [editor])
  const state = editor?.formattingState()
  const disabled = !editor || blocked
  const returnToDocument = () => editor?.apply() ?? false
  const finishInteraction = (open: boolean) => {
    if (!open) returnToDocument()
  }
  const controls = [
    {
      label: "Link",
      Icon: Link,
      action: () => document.dispatchEvent(new Event("paper-edit-link")),
      disabled: !state?.canLink,
    },
    {
      label: "Bulleted list",
      Icon: List,
      action: () => editor?.toggleList("bulletListItem"),
      pressed: state?.list === "bulletListItem",
    },
    {
      label: "Numbered list",
      Icon: ListOrdered,
      action: () => editor?.toggleList("numberedListItem"),
      pressed: state?.list === "numberedListItem",
    },
    {
      label: "Remove formatting",
      Icon: RemoveFormatting,
      action: () => editor?.clearFormatting(),
    },
  ]
  const styleControl = (
    <ToolbarItem label="Paragraph style">
      <Select
        onOpenChangeComplete={finishInteraction}
        value={
          state?.mixedStyle ? "mixed" : (state?.paragraphStyle ?? "normal")
        }
        disabled={disabled}
        onValueChange={(value) => {
          const style = editor?.paragraphStyles.find(
            (item) => item.id === value
          )
          if (style) editor?.apply(() => editor.setParagraphStyle(style.id))
        }}
      >
        <SelectTrigger
          aria-label="Paragraph style"
          className={
            compact
              ? "min-h-11 w-14 shrink-0 border-transparent px-2 md:min-h-8"
              : "min-h-11 w-36 shrink-0 border-transparent px-2 md:min-h-8"
          }
        >
          {compact ? (
            <span aria-hidden="true" className="text-base">
              Aa
            </span>
          ) : (
            <SelectValue>
              {state?.mixedStyle
                ? "Mixed styles"
                : (editor?.paragraphStyles.find(
                    (style) => style.id === state?.paragraphStyle
                  )?.label ??
                  (state?.paragraphStyle ? "Custom style" : undefined) ??
                  "Normal text")}
            </SelectValue>
          )}
        </SelectTrigger>
        <SelectContent finalFocus={returnToDocument}>
          {state?.mixedStyle ? (
            <SelectItem value="mixed" disabled className="min-h-11 md:min-h-8">
              Mixed styles
            </SelectItem>
          ) : null}
          {editor?.paragraphStyles.map((style) => (
            <SelectItem
              key={style.id}
              value={style.id}
              className="min-h-11 md:min-h-8"
            >
              {style.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </ToolbarItem>
  )
  const structureControls = controls.map(control)
  return (
    <>
      {typeof children === "function" ? (
        children({
          style: styleControl,
          controls: structureControls,
          link: structureControls[0],
          lists: structureControls.slice(1, 3),
        })
      ) : (
        <>
          {styleControl}
          {children}
          {structureControls}
        </>
      )}
    </>
  )
  function control(item: (typeof controls)[number]) {
    return (
      <ToolbarItem key={item.label} label={item.label}>
        <ToolbarHint label={item.label}>
          <Button
            variant={item.pressed ? "secondary" : "ghost"}
            size="icon"
            className="size-11 shrink-0 md:size-8"
            aria-label={item.label}
            aria-pressed={item.pressed}
            disabled={disabled || item.disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              editor?.apply(item.action)
              refresh()
            }}
          >
            <item.Icon />
          </Button>
        </ToolbarHint>
      </ToolbarItem>
    )
  }
}
