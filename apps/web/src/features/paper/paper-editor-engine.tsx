import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useReducer,
  useRef,
  type Ref,
} from "react"
import { CollaborationExtension } from "@blocknote/core/yjs"
import { BlockNoteViewRaw, useCreateBlockNote } from "@blocknote/react"
import type { PaperDocument } from "@workspace/domain"
import {
  FRAGMENT,
  letterSchema,
  nativeLetterSchema,
  type ClientChange,
  type PaperClient,
} from "@workspace/paper-crdt"

import "@blocknote/core/style.css"
import "@blocknote/react/style.css"

import { cvSchema } from "./cv-blocks.tsx"
import { handleCvKey } from "./cv-keys.ts"
import { bindYUndo, cvRulesExtension } from "./cv-rules.ts"
import { keywordPlacement } from "./keyword-placement.ts"
import { letterRulesExtension } from "./letter-rules.ts"
import {
  LIST_TYPES,
  backspaceAtListStart,
  changeBlockType,
} from "./list-block-ops.ts"
import { PaperLinkToolbar } from "./paper-editor-link-bar.tsx"
import {
  PaperFormattingToolbar,
  PaperSideMenu,
  PaperSlashMenu,
} from "./paper-editor-menus.tsx"
import { LinkRequestContext } from "./paper-editor-popup.ts"
import { useEditorResume } from "./paper-editor-resume.ts"

export type LetterEditor = ReturnType<typeof useLetterEditor>

export type PaperEditorHandle = {
  insertText(text: string): void
  focusField(name: string, blockId?: string): void
  focusBlock(id: string): void
  undo(): void
}

type Props = {
  kind: "letter"
  client: PaperClient
  generation: number
  label: string
  editable?: boolean
  onDocument: (document: PaperDocument | null, change: ClientChange) => void
  onSelectedBlocks: (ids: string[]) => void
  handleRef?: Ref<PaperEditorHandle>
  onReady?: (editor: LetterEditor) => void
}

const DOCUMENT_DELAY_MS = 120
const SIGN_OFF_BLOCKS = 2
const LEAF_TEXT = "\ufffc"

function useLetterEditor(
  ydoc: PaperClient["ydoc"],
  collaboration: ReturnType<typeof CollaborationExtension>,
  generation: number,
  native: boolean
) {
  return useCreateBlockNote(
    {
      schema: native ? nativeLetterSchema : letterSchema,
      trailingBlock: false,
      extensions: [collaboration, letterRulesExtension],
    },
    [ydoc, generation, native]
  )
}

function focusField(name: string, blockId?: string) {
  const root = blockId
    ? document.querySelector(`[data-cv-block-fields="${CSS.escape(blockId)}"]`)
    : document
  root
    ?.querySelector<HTMLElement>(`[data-cv-field="${CSS.escape(name)}"]`)
    ?.focus()
}

function LetterPaperEngine({
  client,
  generation,
  label,
  editable = true,
  onDocument,
  onSelectedBlocks,
  handleRef,
  onReady,
}: Props) {
  const ydoc = client.ydoc
  const collaboration = useMemo(
    () =>
      CollaborationExtension({
        fragment: ydoc.getXmlFragment(FRAGMENT),
        user: { name: "You", color: "currentColor" },
      }),
    [ydoc]
  )
  const native = client.provenance !== undefined
  const editor = useLetterEditor(ydoc, collaboration, generation, native)
  const [linkCount, requestLink] = useReducer((count: number) => count + 1, 0)
  const linkPending = useRef(false)
  const takeLink = useCallback(() => {
    const pending = linkPending.current
    linkPending.current = false
    return pending
  }, [])
  const linkRequest = useMemo(
    () => ({ count: linkCount, take: takeLink }),
    [linkCount, takeLink]
  )
  const { placed, remember, focusIn, focusOut } = useEditorResume(editor)
  const latest = useRef(onDocument)
  useEffect(() => {
    latest.current = onDocument
  })
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    let kind: ClientChange = "reset"
    const publish = () => {
      timer = null
      const sent = kind
      kind = "remote"
      latest.current(client.document(), sent)
    }
    publish()
    const stop = client.subscribe((change) => {
      if (kind !== "local") kind = change
      if (timer === null) timer = setTimeout(publish, DOCUMENT_DELAY_MS)
    })
    return () => {
      stop()
      if (timer !== null) clearTimeout(timer)
    }
  }, [client, generation])
  useEffect(() => {
    onReady?.(editor)
  }, [editor, onReady])
  useEffect(() => {
    bindYUndo(editor)
  }, [editor])
  useImperativeHandle(
    handleRef,
    () => ({
      insertText(text) {
        if (placed.current) {
          const inserted = editor.transact((tr) => {
            const { $from, from } = tr.selection
            const parent = $from.parent
            if (!parent.inlineContent) return false
            const offset = $from.parentOffset
            const placement = keywordPlacement(
              parent.textBetween(0, offset, undefined, LEAF_TEXT),
              parent.textBetween(
                offset,
                parent.content.size,
                undefined,
                LEAF_TEXT
              ),
              text
            )
            tr.insertText(placement.text, from + placement.skip)
            return true
          })
          if (inserted) return
        }
        const blocks = editor.document
        const anchor = blocks[Math.max(blocks.length - 1 - SIGN_OFF_BLOCKS, 0)]
        if (anchor) {
          editor.insertBlocks(
            [{ type: "paragraph", content: text }],
            anchor,
            "after"
          )
        }
      },
      focusField() {},
      focusBlock() {},
      undo() {
        bindYUndo(editor)
        editor.undo()
      },
    }),
    [editor, placed]
  )
  return (
    <BlockNoteViewRaw
      editor={editor}
      theme="light"
      editable={editable}
      aria-label={label}
      data-slot="letter-block-editor"
      formattingToolbar={false}
      linkToolbar={false}
      slashMenu={false}
      sideMenu={false}
      filePanel={false}
      tableHandles={false}
      emojiPicker={false}
      onFocusCapture={focusIn}
      onBlurCapture={focusOut}
      onKeyDownCapture={(event) => {
        if (!editable || event.nativeEvent.isComposing) return
        if ((event.metaKey || event.ctrlKey) && !event.altKey) {
          const key = event.key.toLowerCase()
          if (key === "u" && !event.shiftKey) {
            event.preventDefault()
            event.stopPropagation()
            if (native) editor._tiptapEditor.commands.toggleMark("underline")
            return
          }
          if (key === "z" || (key === "y" && !event.shiftKey)) {
            event.preventDefault()
            event.stopPropagation()
            bindYUndo(editor)
            if (event.shiftKey || key === "y") editor.redo()
            else editor.undo()
            return
          }
        }
        if (
          (event.metaKey || event.ctrlKey) &&
          !event.altKey &&
          !event.shiftKey &&
          event.key.toLowerCase() === "k"
        ) {
          if (editor.prosemirrorState.selection.empty) return
          event.preventDefault()
          event.stopPropagation()
          linkPending.current = true
          requestLink()
          return
        }
        if (event.metaKey || event.ctrlKey || event.altKey) return
        if (event.nativeEvent.isComposing) return
        if (event.key === "Backspace" && !event.shiftKey) {
          if (!backspaceAtListStart(editor)) return
          event.preventDefault()
          event.stopPropagation()
          return
        }
        if (event.key !== "Enter" || event.shiftKey) return
        const block = editor.getTextCursorPosition().block
        if (!LIST_TYPES.has(block.type)) return
        const filled = (
          block.content as { type: string; text?: string }[]
        ).some((part) => part.type === "link" || (part.text ?? "").length > 0)
        if (filled) return
        event.preventDefault()
        event.stopPropagation()
        if (editor.getParentBlock(block)) editor.unnestBlock()
        else changeBlockType(editor, { type: "paragraph" })
      }}
      onSelectionChange={() => {
        const state = editor.prosemirrorState
        linkPending.current = false
        remember()
        if (state.selection.empty) {
          onSelectedBlocks([])
          return
        }
        const picked = editor.getSelection()?.blocks
        onSelectedBlocks(
          picked
            ? picked.map((block) => block.id)
            : [editor.getTextCursorPosition().block.id]
        )
      }}
    >
      <LinkRequestContext.Provider value={linkRequest}>
        <PaperFormattingToolbar />
        <PaperSlashMenu />
        <PaperLinkToolbar />
        <PaperSideMenu />
      </LinkRequestContext.Provider>
    </BlockNoteViewRaw>
  )
}

const CV_PLACEHOLDERS = {
  bulletListItem: "What you did, and what changed because of it",
  numberedListItem: "What you did, and what changed because of it",
  paperSkillItem: "Tools, software and languages",
}

type CvProps = {
  kind: "cv"
  client: PaperClient
  generation: number
  label: string
  onDocument: (document: PaperDocument | null, change: ClientChange) => void
  onSelectedBlocks: (ids: string[]) => void
  handleRef?: Ref<PaperEditorHandle>
  onReady?: (editor: ReturnType<typeof useCvEditor>) => void
}

function useCvEditor(
  ydoc: PaperClient["ydoc"],
  collaboration: ReturnType<typeof CollaborationExtension>,
  generation: number,
  label: string
) {
  return useCreateBlockNote(
    {
      schema: cvSchema,
      trailingBlock: true,
      placeholders: CV_PLACEHOLDERS,
      extensions: [collaboration, cvRulesExtension],
      domAttributes: { editor: { "aria-label": label } },
    },
    [ydoc, generation, label]
  )
}

function CvPaperEngine({
  client,
  generation,
  label,
  onDocument,
  onSelectedBlocks,
  handleRef,
  onReady,
}: CvProps) {
  const ydoc = client.ydoc
  const collaboration = useMemo(
    () =>
      CollaborationExtension({
        fragment: ydoc.getXmlFragment(FRAGMENT),
        user: { name: "You", color: "currentColor" },
      }),
    [ydoc]
  )
  const editor = useCvEditor(ydoc, collaboration, generation, label)
  const [linkCount, requestLink] = useReducer((count: number) => count + 1, 0)
  const linkPending = useRef(false)
  const takeLink = useCallback(() => {
    const pending = linkPending.current
    linkPending.current = false
    return pending
  }, [])
  const linkRequest = useMemo(
    () => ({ count: linkCount, take: takeLink }),
    [linkCount, takeLink]
  )
  const latest = useRef(onDocument)
  useEffect(() => {
    latest.current = onDocument
  })
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    let kind: ClientChange = "reset"
    const publish = () => {
      timer = null
      const sent = kind
      kind = "remote"
      latest.current(client.document(), sent)
    }
    publish()
    const stop = client.subscribe((change) => {
      if (kind !== "local") kind = change
      if (timer === null) timer = setTimeout(publish, DOCUMENT_DELAY_MS)
    })
    return () => {
      stop()
      if (timer !== null) clearTimeout(timer)
    }
  }, [client, generation])
  useEffect(() => {
    onReady?.(editor)
  }, [editor, onReady])
  useEffect(() => {
    bindYUndo(editor)
  }, [editor])
  useEffect(() => {
    document
      .querySelector("[data-cv-editor] .bn-editor")
      ?.setAttribute("aria-label", label)
  }, [editor, label])
  useImperativeHandle(
    handleRef,
    () => ({
      insertText(text) {
        let placed = false
        try {
          const block = editor.getTextCursorPosition().block
          if (Array.isArray(block.content)) {
            editor.insertInlineContent(text)
            placed = true
          }
        } catch {
          placed = false
        }
        if (placed) return
        const blocks = editor.document
        const anchor = blocks[blocks.length - 1]
        if (!anchor) return
        editor.insertBlocks(
          [{ type: "paragraph", content: text }],
          anchor,
          "after"
        )
      },
      focusField,
      focusBlock(id) {
        const field = document.querySelector<HTMLElement>(
          `[data-cv-block-fields="${CSS.escape(id)}"] [data-cv-field]`
        )
        if (field) {
          field.focus()
          return
        }
        editor.setTextCursorPosition(id, "start")
        editor.focus()
      },
      undo() {
        bindYUndo(editor)
        editor.undo()
      },
    }),
    [editor]
  )
  return (
    <BlockNoteViewRaw
      editor={editor}
      theme="light"
      aria-label={label}
      data-cv-editor=""
      data-slot="cv-block-editor"
      formattingToolbar={false}
      linkToolbar={false}
      slashMenu={false}
      sideMenu={false}
      filePanel={false}
      tableHandles={false}
      emojiPicker={false}
      onKeyDownCapture={(event) => {
        const target = event.target
        const typing =
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement
        if (
          (event.metaKey || event.ctrlKey) &&
          !event.altKey &&
          !event.shiftKey &&
          event.key.toLowerCase() === "k"
        ) {
          if (typing || editor.prosemirrorState.selection.empty) return
          event.preventDefault()
          event.stopPropagation()
          linkPending.current = true
          requestLink()
          return
        }
        if (handleCvKey(editor, event)) return
        if (
          !typing &&
          (event.metaKey || event.ctrlKey) &&
          !event.altKey &&
          event.key.toLowerCase() === "z"
        ) {
          event.preventDefault()
          event.stopPropagation()
          bindYUndo(editor)
          if (event.shiftKey) editor.redo()
          else editor.undo()
          return
        }
        if (typing) return
        if (event.metaKey || event.ctrlKey || event.altKey) return
        if (event.nativeEvent.isComposing) return
        if (event.key === "Backspace" && !event.shiftKey) {
          if (!backspaceAtListStart(editor)) return
          event.preventDefault()
          event.stopPropagation()
          return
        }
        if (event.key !== "Enter" || event.shiftKey) return
        const block = editor.getTextCursorPosition().block
        if (!LIST_TYPES.has(block.type)) return
        const filled = (
          block.content as { type: string; text?: string }[]
        ).some((part) => part.type === "link" || (part.text ?? "").length > 0)
        if (filled) return
        event.preventDefault()
        event.stopPropagation()
        if (editor.getParentBlock(block)) editor.unnestBlock()
        else changeBlockType(editor, { type: "paragraph" })
      }}
      onSelectionChange={() => {
        const state = editor.prosemirrorState
        linkPending.current = false
        if (state.selection.empty) {
          const row = document.activeElement?.closest("[data-cv-block-fields]")
          const id = row?.getAttribute("data-cv-block-fields")
          onSelectedBlocks(id ? [id] : [])
          return
        }
        const picked = editor.getSelection()?.blocks
        onSelectedBlocks(
          picked
            ? picked.map((block) => block.id)
            : [editor.getTextCursorPosition().block.id]
        )
      }}
    >
      <LinkRequestContext.Provider value={linkRequest}>
        <PaperFormattingToolbar />
        <PaperSlashMenu />
        <PaperLinkToolbar />
        <PaperSideMenu />
      </LinkRequestContext.Provider>
    </BlockNoteViewRaw>
  )
}

export function PaperEditorEngine(props: Props | CvProps) {
  if (props.kind === "cv") return <CvPaperEngine {...props} />
  return <LetterPaperEngine {...props} />
}
