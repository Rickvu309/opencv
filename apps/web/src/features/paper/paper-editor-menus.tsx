import { useContext, useEffect, useReducer, useRef } from "react"
import type {
  BlockSchema,
  InlineContentSchema,
  StyleSchema,
} from "@blocknote/core"
import {
  FormattingToolbarExtension,
  SideMenuExtension,
} from "@blocknote/core/extensions"
import {
  FormattingToolbarController,
  SideMenuController,
  useBlockNoteEditor,
  useEditorState,
  useExtension,
  useExtensionState,
} from "@blocknote/react"
import { NodeSelection } from "prosemirror-state"
import {
  Bold,
  ChevronDown,
  GripVertical,
  Italic,
  Link as LinkIcon,
  MessageCircle,
  Plus,
} from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { CvBlockMenu } from "./cv-block-menu.tsx"
import { CvChromeContext } from "./cv-blocks.tsx"
import { addedBlockType, cvFormatHidden } from "./cv-keys.ts"
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

export { PaperSlashMenu } from "./paper-editor-slash.tsx"

type BlockChoice = {
  label: string
  type: string
  props?: Record<string, unknown>
}

const TOOLBAR_ABOVE_SELECTION = 15
const TOOLBAR_BEFORE_SELECTION = 67

const cvToolbarFloating = {
  useFloatingOptions: {
    placement: "top-start" as const,
    middleware: [
      {
        name: "cvToolbarOffset",
        fn(state: {
          x: number
          y: number
          placement: string
          rects: { floating: { width: number; height: number } }
        }) {
          const side = state.placement.split("-")[0]
          let x = state.x
          let y = state.y
          if (side === "top") {
            x -= TOOLBAR_BEFORE_SELECTION
            y -= TOOLBAR_ABOVE_SELECTION
          } else if (side === "bottom") {
            x -= TOOLBAR_BEFORE_SELECTION
            y += TOOLBAR_ABOVE_SELECTION
          } else if (side === "left") {
            x -= TOOLBAR_ABOVE_SELECTION
            y -= TOOLBAR_BEFORE_SELECTION
          } else {
            x += TOOLBAR_ABOVE_SELECTION
            y -= TOOLBAR_BEFORE_SELECTION
          }
          const edge = 8
          const width = state.rects.floating.width
          const height = state.rects.floating.height
          x = Math.min(
            Math.max(edge, x),
            Math.max(edge, window.innerWidth - edge - width)
          )
          y = Math.min(
            Math.max(edge, y),
            Math.max(edge, window.innerHeight - edge - height)
          )
          return { x, y }
        },
      },
    ],
  },
}

const BLOCK_CHOICES: BlockChoice[] = [
  { label: "Text", type: "paragraph" },
  { label: "Heading 2", type: "heading", props: { level: 2 } },
  { label: "Heading 3", type: "heading", props: { level: 3 } },
  { label: "Bulleted list", type: "bulletListItem" },
  { label: "Numbered list", type: "numberedListItem" },
]

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
  const cv = "paperHeader" in editor.schema.blockSchema
  const matched =
    choices.find(
      (choice) =>
        current === `${choice.type}:${String(choice.props?.level ?? "")}`
    )?.label ?? "Text"
  const label =
    cv && (current.startsWith("bulletListItem") || current === "paragraph:")
      ? "Text"
      : matched
  const nodeName = useEditorState({
    editor,
    selector: ({ editor: live }) => {
      const selection = live.prosemirrorState.selection
      return selection instanceof NodeSelection
        ? selection.node.type.name
        : null
    },
  })
  const chrome = useContext(CvChromeContext)
  const hidden = cvFormatHidden(
    document.activeElement?.closest("[data-cv-field]") != null,
    nodeName
  )
  const toggle = (name: "bold" | "italic") => {
    editor.toggleStyles({ [name]: true } as never)
    editor.focus()
  }
  if (hidden) return null
  return (
    <div
      role="toolbar"
      aria-label="Format"
      data-pen-surface={cv ? "paper" : undefined}
      data-slot="paper-format-toolbar"
      className="flex items-center gap-0.5 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
    >
      {cv ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-cv-format-coach=""
          className="h-11 px-1.5 text-xs md:h-6"
          onClick={() => chrome.askCoach("")}
        >
          <MessageCircle className="size-3" aria-hidden="true" />
          Coach
        </Button>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-cv-format-text=""
              className="h-11 gap-1 px-1.5 text-xs md:h-6"
            >
              {label}
              {cv ? (
                <ChevronDown className="size-[9px]" aria-hidden="true" />
              ) : null}
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
        className="size-11 p-0 md:size-6"
        onClick={() => toggle("bold")}
      >
        <Bold className="size-3.5" aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant={styles.italic ? "secondary" : "ghost"}
        size="sm"
        aria-label="Italic"
        aria-pressed={Boolean(styles.italic)}
        className="size-11 p-0 md:size-6"
        onClick={() => toggle("italic")}
      >
        <Italic className="size-3.5" aria-hidden="true" />
      </Button>
      {cv ? (
        <span aria-hidden="true" className="inline-block w-[22px]" />
      ) : null}
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
  const editor = useBlockNoteEditor()
  useExtension(FormattingToolbarExtension)
  const cv = "paperHeader" in editor.schema.blockSchema
  return (
    <FormattingToolbarController
      formattingToolbar={SelectionFormat}
      floatingUIOptions={cv ? cvToolbarFloating : undefined}
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
          const parent = editor.getParentBlock(block)
          const type = addedBlockType(block.type, parent?.type)
          const created = editor.insertBlocks([{ type }], block, "after")
          const next = created[0]
          if (!next || !editor.getBlock(next.id)) return
          editor.setTextCursorPosition(next, "start")
          editor.focus()
        }}
      >
        <Plus className="size-3.5" aria-hidden="true" />
      </Button>
      {cv ? (
        <CvBlockMenu
          block={block}
          onDragStart={(event) => side.blockDragStart(event, block)}
          onDragEnd={() => side.blockDragEnd()}
        />
      ) : (
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
      )}
    </div>
  )
}

function pointerOnOpenMenu(target: EventTarget | null) {
  if (!(target instanceof Element)) return false
  if (
    target.closest("[data-slot='cv-block-menu']") ||
    target.closest("[data-slot='dropdown-menu-sub-content']") ||
    target.closest("[role='menu']")
  ) {
    return true
  }
  return (
    Boolean(target.closest("[aria-label='Drag block']")) &&
    Boolean(document.querySelector("[data-slot='cv-block-menu']"))
  )
}

function SideMenuRelease() {
  const side = useExtension(SideMenuExtension)
  const dragging = useRef(false)
  useEffect(() => {
    const root = document
    const onDragStart = (event: DragEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (!target.closest("[aria-label='Drag block']")) return
      dragging.current = true
      document.documentElement.setAttribute("data-cv-dragging", "")
    }
    const finishDrag = () => {
      if (!dragging.current) return
      dragging.current = false
      side.blockDragEnd()
      if (side.menuFrozen) side.unfreezeMenu()
    }
    const onDragOver = (event: DragEvent) => {
      if (!dragging.current) return
      event.preventDefault()
    }
    const onDragEnd = () => {
      document.documentElement.removeAttribute("data-cv-dragging")
      finishDrag()
    }
    const releaseMenu = () => {
      queueMicrotask(() => {
        if (dragging.current) return
        if (side.menuFrozen) side.unfreezeMenu()
      })
    }
    const onPointerUp = (event: PointerEvent) => {
      if (pointerOnOpenMenu(event.target)) return
      releaseMenu()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      finishDrag()
      if (side.menuFrozen) side.unfreezeMenu()
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!side.menuFrozen) return
      const target = event.target
      if (pointerOnOpenMenu(target)) return
      if (
        target instanceof Element &&
        target.closest("[data-slot='paper-side-menu']")
      ) {
        return
      }
      side.unfreezeMenu()
    }
    root.addEventListener("dragstart", onDragStart, true)
    root.addEventListener("dragover", onDragOver)
    root.addEventListener("dragend", onDragEnd, true)
    root.addEventListener("pointerup", onPointerUp, true)
    root.addEventListener("keydown", onKey, true)
    root.addEventListener("pointerdown", onPointerDown, true)
    return () => {
      root.removeEventListener("dragstart", onDragStart, true)
      root.removeEventListener("dragover", onDragOver)
      root.removeEventListener("dragend", onDragEnd, true)
      root.removeEventListener("pointerup", onPointerUp, true)
      root.removeEventListener("keydown", onKey, true)
      root.removeEventListener("pointerdown", onPointerDown, true)
    }
  }, [side])
  return null
}

export function PaperSideMenu() {
  return (
    <>
      <SideMenuRelease />
      <SideMenuController sideMenu={Handle} />
    </>
  )
}
