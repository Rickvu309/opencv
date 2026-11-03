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
  type ClientChange,
  type PaperClient,
} from "@workspace/paper-crdt"

import "@blocknote/core/style.css"
import "@blocknote/react/style.css"

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
}

type Props = {
  kind: "letter"
  client: PaperClient
  generation: number
  label: string
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
  generation: number
) {
  return useCreateBlockNote(
    {
      schema: letterSchema,
      trailingBlock: false,
      extensions: [collaboration, letterRulesExtension],
    },
    [ydoc, generation]
  )
}

export function PaperEditorEngine({
  client,
  generation,
  label,
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
  const editor = useLetterEditor(ydoc, collaboration, generation)
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
    }),
    [editor, placed]
  )
  return (
    <BlockNoteViewRaw
      editor={editor}
      theme="light"
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
