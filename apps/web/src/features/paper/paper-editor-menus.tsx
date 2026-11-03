import { useContext, useEffect, useReducer, useRef } from "react"
import type {
  BlockSchema,
  InlineContentSchema,
  StyleSchema,
} from "@blocknote/core"
import {
  filterSuggestionItems,
  FormattingToolbarExtension,
  SideMenuExtension,
} from "@blocknote/core/extensions"
import {
  FormattingToolbarController,
  getDefaultReactSlashMenuItems,
  SideMenuController,
  SuggestionMenuController,
  useBlockNoteEditor,
  useEditorState,
  useExtension,
  useExtensionState,
  type DefaultReactSuggestionItem,
  type SuggestionMenuProps,
} from "@blocknote/react"
import { GripVertical, Link as LinkIcon, Plus } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { CvBlockMenu } from "./cv-block-menu.tsx"
import { cvSlashItems, filterCvSlash } from "./cv-slash.ts"
import { normalizeHref } from "./link-href.ts"
import { LinkRequestContext, useEditorPopupRef } from "./paper-editor-popup.ts"
import {
  LIST_TYPES,
  changeBlockType,
  isNestedListItem,
} from "./list-block-ops.ts"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Input } from "@workspace/ui/components/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { cn } from "@workspace/ui/lib/utils"

type BlockChoice = {
  label: string
  type: string
  props?: Record<string, unknown>
}

const BLOCK_CHOICES: BlockChoice[] = [
  { label: "Text", type: "paragraph" },
  { label: "Heading 2", type: "heading", props: { level: 2 } },
  { label: "Heading 3", type: "heading", props: { level: 3 } },
  { label: "Bulleted list", type: "bulletListItem" },
  { label: "Numbered list", type: "numberedListItem" },
]

const SLASH_TITLES = new Set([
  "Paragraph",
  "Heading 2",
  "Heading 3",
  "Numbered List",
  "Bullet List",
  "Divider",
])

function useChoices() {
  const editor = useBlockNoteEditor<
    BlockSchema,
    InlineContentSchema,
    StyleSchema
  >()
  const known = Object.keys(editor.schema.blockSchema)
  return {
    editor,
    choices: BLOCK_CHOICES.filter((c) => known.includes(c.type)),
  }
}

type FormatState = { href: string; linkOpen: boolean }

type FormatAction =
  | { type: "open"; href: string }
  | { type: "type"; href: string }
  | { type: "close" }

function formatReducer(state: FormatState, action: FormatAction): FormatState {
  if (action.type === "open") return { href: action.href, linkOpen: true }
  if (action.type === "type") return { ...state, href: action.href }
  return { href: "", linkOpen: false }
}

function SelectionFormat() {
  const { editor, choices } = useChoices()
  const menuRef = useEditorPopupRef()
  const linkRef = useEditorPopupRef()
  const [{ href, linkOpen }, dispatch] = useReducer(formatReducer, {
    href: "",
    linkOpen: false,
  })
  const { count: linkRequests, take: takeLinkRequest } =
    useContext(LinkRequestContext)
  useEffect(() => {
    if (!takeLinkRequest()) return
    dispatch({ type: "open", href: editor.getSelectedLinkUrl() ?? "" })
  }, [linkRequests, takeLinkRequest, editor])
  const link = normalizeHref(href)
  const backToText = useRef(false)
  const closeToText = () => {
    backToText.current = true
    dispatch({ type: "close" })
    editor.focus()
  }
  const addLink = () => {
    if (link === null) return
    editor.createLink(link)
    closeToText()
  }
  const styles = useEditorState({
    editor,
    selector: ({ editor: live }) => live.getActiveStyles(),
  }) as Record<string, unknown>
  const current = useEditorState({
    editor,
    selector: ({ editor: live }) => {
      const block = live.getTextCursorPosition().block
      return `${block.type}:${String((block.props as { level?: number }).level ?? "")}`
    },
  })
  const nested = useEditorState({
    editor,
    selector: ({ editor: live }) => isNestedListItem(live),
  })
  const label =
    choices.find(
      (choice) =>
        current === `${choice.type}:${String(choice.props?.level ?? "")}`
    )?.label ?? "Text"
  const toggle = (name: "bold" | "italic") => {
    editor.toggleStyles({ [name]: true } as never)
    editor.focus()
  }
  return (
    <div
      role="toolbar"
      aria-label="Format"
      data-slot="paper-format-toolbar"
      className="flex items-center gap-0.5 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
    >
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-11 text-xs md:h-7"
            >
              {label}
            </Button>
          }
        />
        <DropdownMenuContent align="start" ref={menuRef}>
          {choices.map((choice) => {
            const blocked = nested && !LIST_TYPES.has(choice.type)
            return (
              <DropdownMenuItem
                key={choice.label}
                disabled={blocked}
                onClick={() => {
                  changeBlockType(editor, choice)
                  editor.focus()
                }}
              >
                {choice.label}
                {blocked ? " (outdent the item first)" : ""}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        type="button"
        variant={styles.bold ? "secondary" : "ghost"}
        size="sm"
        aria-label="Bold"
        aria-pressed={Boolean(styles.bold)}
        className="size-11 p-0 font-bold md:size-7"
        onClick={() => toggle("bold")}
      >
        B
      </Button>
      <Button
        type="button"
        variant={styles.italic ? "secondary" : "ghost"}
        size="sm"
        aria-label="Italic"
        aria-pressed={Boolean(styles.italic)}
        className="size-11 p-0 italic md:size-7"
        onClick={() => toggle("italic")}
      >
        I
      </Button>
      <Popover
        open={linkOpen}
        onOpenChange={(open, details) => {
          if (open) {
            dispatch({ type: "open", href: editor.getSelectedLinkUrl() ?? "" })
          } else if (details.reason === "escape-key") {
            closeToText()
          } else {
            dispatch({ type: "close" })
          }
        }}
      >
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Link"
              className="size-11 p-0 md:size-7"
            >
              <LinkIcon className="size-3.5" aria-hidden="true" />
            </Button>
          }
        />
        <PopoverContent
          ref={linkRef}
          className="flex w-64 flex-wrap gap-1.5 p-2"
          finalFocus={() => {
            if (!backToText.current) return true
            backToText.current = false
            editor.focus()
            return false
          }}
        >
          <Input
            aria-label="Link address"
            placeholder="https://"
            value={href}
            onChange={(event) =>
              dispatch({ type: "type", href: event.target.value })
            }
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.nativeEvent.isComposing) return
              event.preventDefault()
              addLink()
            }}
          />
          <Button
            type="button"
            size="sm"
            className="h-11 md:h-7"
            disabled={link === null}
            onClick={addLink}
          >
            Add
          </Button>
          {href.trim() && link === null ? (
            <p role="alert" className="w-full text-xs text-muted-foreground">
              Use an http, https or mailto link.
            </p>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  )
}

export function PaperFormattingToolbar() {
  useExtension(FormattingToolbarExtension)
  return <FormattingToolbarController formattingToolbar={SelectionFormat} />
}

function SlashList({
  items,
  selectedIndex,
  onItemClick,
}: SuggestionMenuProps<DefaultReactSuggestionItem>) {
  const editor = useBlockNoteEditor<
    BlockSchema,
    InlineContentSchema,
    StyleSchema
  >()
  const cv = "paperHeader" in editor.schema.blockSchema
  return (
    <div
      role="listbox"
      aria-label="Blocks"
      data-slot="paper-slash-menu"
      className={cn(
        "flex flex-col gap-0.5 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md",
        cv ? "w-[300px]" : "w-56"
      )}
    >
      {items.map((item, index) => {
        const group = item.group ?? ""
        const before = items[index - 1]?.group ?? ""
        const showGroup = cv && group !== before
        const divider = showGroup && before !== "" && group === "Blocks"
        return (
          <div key={item.title}>
            {divider ? (
              <div role="separator" className="my-1 h-px bg-border" />
            ) : null}
            {showGroup ? (
              <p className="px-2 py-1 text-xs text-muted-foreground">{group}</p>
            ) : null}
            <Button
              type="button"
              role="option"
              aria-selected={index === selectedIndex}
              variant="ghost"
              size="sm"
              className={cn(
                "h-11 w-full justify-start text-xs md:h-8",
                index === selectedIndex && "bg-accent text-accent-foreground"
              )}
              onClick={() => onItemClick?.(item)}
            >
              {item.title}
              {cv && item.subtext ? (
                <span className="ms-2 text-muted-foreground">
                  {item.subtext}
                </span>
              ) : null}
            </Button>
          </div>
        )
      })}
      {items.length === 0 ? (
        <p className="px-2 py-1.5 text-xs text-muted-foreground">No blocks</p>
      ) : null}
    </div>
  )
}

export function PaperSlashMenu() {
  const editor = useBlockNoteEditor<
    BlockSchema,
    InlineContentSchema,
    StyleSchema
  >()
  return (
    <SuggestionMenuController
      triggerCharacter="/"
      getItems={async (query) =>
        "paperHeader" in editor.schema.blockSchema
          ? filterCvSlash(cvSlashItems(editor), query)
          : filterSuggestionItems(
              getDefaultReactSlashMenuItems(editor).filter((item) =>
                SLASH_TITLES.has(item.title)
              ),
              query
            )
      }
      suggestionMenuComponent={SlashList}
    />
  )
}

function Handle() {
  const editor = useBlockNoteEditor<
    BlockSchema,
    InlineContentSchema,
    StyleSchema
  >()
  const side = useExtension(SideMenuExtension)
  const block = useExtensionState(SideMenuExtension, {
    selector: (state) => state?.block,
  })
  if (!block || block.type === "paperHeader") return null
  const cv = "paperExperience" in editor.schema.blockSchema
  return (
    <div
      data-slot="paper-side-menu"
      className="flex items-center gap-0.5 text-muted-foreground"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Add block below"
        className="size-11 md:size-6"
        onClick={() => {
          const created = editor.insertBlocks(
            [{ type: "paragraph" }],
            block,
            "after"
          )
          editor.setTextCursorPosition(created[0]!, "start")
          editor.focus()
        }}
      >
        <Plus className="size-3.5" aria-hidden="true" />
      </Button>
      <div
        role="button"
        tabIndex={0}
        aria-label="Drag block"
        draggable
        className="flex size-11 cursor-grab items-center justify-center rounded-md hover:bg-accent md:size-6"
        onDragStart={(event) => side.blockDragStart(event, block)}
        onDragEnd={() => side.blockDragEnd()}
      >
        <GripVertical className="size-3.5" aria-hidden="true" />
      </div>
      {cv ? <CvBlockMenu block={block} /> : null}
    </div>
  )
}

export function PaperSideMenu() {
  return <SideMenuController sideMenu={Handle} />
}
