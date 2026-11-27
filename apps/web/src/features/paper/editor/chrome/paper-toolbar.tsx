import { useReducer, type ReactNode } from "react"
import {
  Bold,
  Italic,
  Link,
  List,
  ListOrdered,
  Redo2,
  Underline,
  Undo2,
} from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"

import type { DocCommand, Range } from "@workspace/domain/paper-doc"

import type { KeyAction } from "../input-port.ts"
import type { PaperEditor } from "../paper-editor.ts"
import {
  alignCommands,
  dividerCommands,
  fontCommands,
  lineSpacingCommands,
  linkCommands,
  markCommands,
  styleCommands,
  tableCommands,
} from "./format-commands.ts"
import type { SelectionFormat } from "./selection-format.ts"
import {
  AlignMenu,
  FontMenu,
  MoreMenu,
  StyleMenu,
  type MoreAction,
} from "./toolbar-menus.tsx"

type ToolbarProps = {
  editor: PaperEditor
  format: SelectionFormat
  history: { undo: boolean; redo: boolean }
  linkOpen: boolean
  onLinkOpen: (open: boolean) => void
  photoReason: string
}

function Tool({
  label,
  shortcut,
  pressed,
  disabled,
  onPress,
  children,
}: {
  label: string
  shortcut?: string
  pressed?: boolean
  disabled?: boolean
  onPress: () => void
  children: ReactNode
}) {
  return (
    <Button
      variant="ghost"
      size="touch"
      className="paper-tool"
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-pressed={pressed}
      aria-disabled={disabled || undefined}
      onClick={() => {
        if (!disabled) onPress()
      }}
    >
      {children}
    </Button>
  )
}

const Sep = () => <span className="paper-toolbar-sep" aria-hidden="true" />

type LinkDraftAction = { type: "typed"; href: string } | { type: "cleared" }

function linkDraft(_href: string, action: LinkDraftAction): string {
  return action.type === "typed" ? action.href : ""
}

function LinkTool({
  open,
  onOpen,
  onApply,
}: {
  open: boolean
  onOpen: (open: boolean) => void
  onApply: (href: string) => void
}) {
  const [href, dispatch] = useReducer(linkDraft, "")
  return (
    <Popover open={open} onOpenChange={onOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="touch"
            className="paper-tool"
            aria-label="Link"
            title="Link (Ctrl+K)"
          />
        }
      >
        <Link />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        aria-label="Add link"
        className="w-80 flex-row gap-1.5 p-1.5"
      >
        <form
          noValidate
          className="contents"
          onSubmit={(event) => {
            event.preventDefault()
            onApply(href)
            dispatch({ type: "cleared" })
          }}
        >
          <Input
            autoFocus
            type="url"
            value={href}
            placeholder="Paste a link"
            aria-label="Link address"
            className="min-w-0 flex-1"
            onChange={(event) =>
              dispatch({ type: "typed", href: event.target.value })
            }
          />
          <Button type="submit" size="touch">
            Apply
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}

export function PaperToolbar({
  editor,
  format,
  history,
  linkOpen,
  onLinkOpen,
  photoReason,
}: ToolbarProps) {
  const back = (): false => {
    editor.focus()
    return false
  }
  const apply = (build: (range: Range) => DocCommand[]) => {
    const commands = build(editor.range())
    if (commands.length) editor.apply(commands)
    editor.focus()
  }
  const doc = () => editor.read().doc
  const act = (action: KeyAction) => {
    editor.act(action)
    editor.focus()
  }
  const more = (action: MoreAction) => {
    if (action === "indent") return act({ do: "level", by: 1 })
    if (action === "outdent") return act({ do: "level", by: -1 })
    if (action === "clearFormatting") return act({ do: "clearFormatting" })
    if (action === "strike")
      return apply((range) => markCommands(doc(), range, "strike"))
    if (action === "lineSpacing")
      return apply((range) =>
        lineSpacingCommands(doc(), range, format.lineSpacing)
      )
    if (action === "divider") return apply(dividerCommands)
    return apply(tableCommands)
  }
  const applyLink = (href: string) => {
    onLinkOpen(false)
    apply((range) => linkCommands(range, href, format.collapsed))
  }
  return (
    <div className="paper-toolbar" role="toolbar" aria-label="Formatting">
      <div className="paper-toolbar-group">
        <Tool
          label="Undo"
          shortcut="Ctrl+Z"
          disabled={!history.undo}
          onPress={() => act({ do: "undo" })}
        >
          <Undo2 />
        </Tool>
        <Tool
          label="Redo"
          shortcut="Ctrl+Shift+Z"
          disabled={!history.redo}
          onPress={() => act({ do: "redo" })}
        >
          <Redo2 />
        </Tool>
        <Sep />
        <StyleMenu
          format={format}
          back={back}
          onStyle={(kind) =>
            apply((range) => styleCommands(doc(), range, kind))
          }
        />
        <FontMenu
          format={format}
          back={back}
          onFont={(family) => apply((range) => fontCommands(range, family))}
        />
        <Sep />
        <MoreMenu
          format={format}
          back={back}
          onMore={more}
          photoReason={photoReason}
        />
      </div>
      <div className="paper-toolbar-group">
        <Tool
          label="Bold"
          shortcut="Ctrl+B"
          pressed={format.marks.bold}
          onPress={() => act({ do: "mark", mark: "bold" })}
        >
          <Bold />
        </Tool>
        <Tool
          label="Italic"
          shortcut="Ctrl+I"
          pressed={format.marks.italic}
          onPress={() => act({ do: "mark", mark: "italic" })}
        >
          <Italic />
        </Tool>
        <Tool
          label="Underline"
          shortcut="Ctrl+U"
          pressed={format.marks.underline}
          onPress={() => act({ do: "mark", mark: "underline" })}
        >
          <Underline />
        </Tool>
        <Sep />
        <LinkTool open={linkOpen} onOpen={onLinkOpen} onApply={applyLink} />
        <Sep />
        <Tool
          label="Bulleted list"
          shortcut="Ctrl+Shift+8"
          pressed={format.list === "bullet"}
          onPress={() => act({ do: "list", list: "bullet" })}
        >
          <List />
        </Tool>
        <Tool
          label="Numbered list"
          shortcut="Ctrl+Shift+7"
          pressed={format.list === "numbered"}
          onPress={() => act({ do: "list", list: "numbered" })}
        >
          <ListOrdered />
        </Tool>
        <AlignMenu
          format={format}
          back={back}
          onAlign={(align) =>
            apply((range) => alignCommands(doc(), range, align))
          }
        />
        <Sep />
      </div>
    </div>
  )
}
