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
import { useToolbarFold, type FoldableTool } from "./toolbar-fold.ts"
import {
  ALIGN_CHOICES,
  AlignMenu,
  FontMenu,
  MoreMenu,
  StyleMenu,
  type FoldedItem,
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
  folds,
  onPress,
  children,
}: {
  label: string
  shortcut?: string
  pressed?: boolean
  disabled?: boolean
  folds?: readonly FoldableTool[]
  onPress: () => void
  children: ReactNode
}) {
  return (
    <Button
      variant="ghost"
      size="touch"
      className="paper-tool"
      data-fold={folds ? label : undefined}
      data-folded={folds?.some((tool) => tool === label) ? "" : undefined}
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
  folded,
  anchor,
}: {
  open: boolean
  onOpen: (open: boolean) => void
  onApply: (href: string) => void
  folded: boolean
  anchor: () => Element | null
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
            data-fold="Link"
            data-folded={folded ? "" : undefined}
          />
        }
      >
        <Link />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        anchor={folded ? anchor : undefined}
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
  const { ref, folded } = useToolbarFold(`${format.style} ${format.font}`)
  const isFolded = (tool: FoldableTool) => folded.includes(tool)
  const moreButton = () =>
    ref.current?.querySelector('[aria-label="More"]') ?? null
  const foldedItems: Record<FoldableTool, FoldedItem[]> = {
    Redo: [
      {
        tool: "Redo",
        label: "Redo",
        icon: <Redo2 />,
        disabled: !history.redo,
        run: () => act({ do: "redo" }),
      },
    ],
    Link: [
      {
        tool: "Link",
        label: "Link",
        icon: <Link />,
        run: () => onLinkOpen(true),
      },
    ],
    Undo: [
      {
        tool: "Undo",
        label: "Undo",
        icon: <Undo2 />,
        disabled: !history.undo,
        run: () => act({ do: "undo" }),
      },
    ],
    Align: ALIGN_CHOICES.map((choice) => ({
      tool: "Align",
      label: `Align ${choice.label.toLowerCase()}`,
      icon: <choice.icon />,
      run: () => apply((range) => alignCommands(doc(), range, choice.align)),
    })),
    "Numbered list": [
      {
        tool: "Numbered list",
        label: "Numbered list",
        icon: <ListOrdered />,
        run: () => act({ do: "list", list: "numbered" }),
      },
    ],
    Underline: [
      {
        tool: "Underline",
        label: "Underline",
        icon: <Underline />,
        run: () => act({ do: "mark", mark: "underline" }),
      },
    ],
  }
  return (
    <div
      ref={ref}
      className="paper-toolbar"
      role="toolbar"
      aria-label="Formatting"
    >
      <div className="paper-toolbar-group">
        <Tool
          label="Undo"
          shortcut="Ctrl+Z"
          folds={folded}
          disabled={!history.undo}
          onPress={() => act({ do: "undo" })}
        >
          <Undo2 />
        </Tool>
        <Tool
          label="Redo"
          shortcut="Ctrl+Shift+Z"
          folds={folded}
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
          folded={folded.flatMap((tool) => foldedItems[tool])}
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
          folds={folded}
          pressed={format.marks.underline}
          onPress={() => act({ do: "mark", mark: "underline" })}
        >
          <Underline />
        </Tool>
        <Sep />
        <LinkTool
          open={linkOpen}
          onOpen={onLinkOpen}
          onApply={applyLink}
          folded={isFolded("Link")}
          anchor={moreButton}
        />
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
          folds={folded}
          pressed={format.list === "numbered"}
          onPress={() => act({ do: "list", list: "numbered" })}
        >
          <ListOrdered />
        </Tool>
        <AlignMenu
          format={format}
          back={back}
          folded={isFolded("Align")}
          onAlign={(align) =>
            apply((range) => alignCommands(doc(), range, align))
          }
        />
        <Sep />
      </div>
    </div>
  )
}
