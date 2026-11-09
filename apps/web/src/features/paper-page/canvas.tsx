import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
} from "react"
import { cn } from "@workspace/ui/lib/utils"

import {
  blankDraft,
  clearedOnReload,
  commitComposition,
  deleteBackward,
  deleteForward,
  insertText,
  keptOnThisComputer,
  loadDraft,
  pointSpan,
  replaceVisible,
  splitParagraph,
  storeDraft,
  type TextPoint,
  type TextSpan,
  type WritingDraft,
} from "./canvas-edit.ts"
import { pastePlain } from "./canvas-paste.ts"
import "./canvas.css"

type CanvasState = {
  past: WritingDraft[]
  present: WritingDraft
  note: string
}

type CanvasAction =
  | { type: "insert"; span: TextSpan; text: string }
  | { type: "split"; span: TextSpan }
  | { type: "backward"; span: TextSpan }
  | { type: "forward"; span: TextSpan }
  | { type: "paste"; span: TextSpan; text: string }
  | {
      type: "composed"
      texts: { id: string; text: string }[]
      caret: TextPoint
      split: boolean
      nextId: number
    }
  | { type: "undo" }
  | { type: "note"; note: string }

function remember(state: CanvasState, present: WritingDraft): CanvasState {
  if (JSON.stringify(state.present) === JSON.stringify(present)) return state
  return {
    ...state,
    past: state.past.concat(state.present).slice(-50),
    present,
  }
}

function reduce(state: CanvasState, action: CanvasAction): CanvasState {
  if (action.type === "note") {
    return state.note === action.note ? state : { ...state, note: action.note }
  }
  if (action.type === "undo") {
    const present = state.past[state.past.length - 1]
    if (!present) return state
    return { ...state, past: state.past.slice(0, -1), present }
  }
  if (action.type === "composed") {
    const visible = replaceVisible(
      { ...state.present, nextId: action.nextId },
      action.texts,
      action.caret
    )
    const present = action.split
      ? commitComposition({ ...visible, caret: action.caret }, "", true)
      : visible
    return remember(state, present)
  }
  const span = action.span
  const present =
    action.type === "insert"
      ? insertText(state.present, span, action.text)
      : action.type === "split"
        ? splitParagraph(state.present, span)
        : action.type === "backward"
          ? deleteBackward(state.present, span)
          : action.type === "forward"
            ? deleteForward(state.present, span)
            : pastePlain(state.present, span, action.text)
  return remember(state, present)
}

function visibleText(text: string) {
  return text.length === 0 ? "\u200b" : text
}

function blockElement(node: Node | null) {
  const element =
    node?.nodeType === Node.TEXT_NODE
      ? node.parentElement
      : (node as Element | null)
  return element?.closest("p") ?? null
}

function pointFrom(
  root: HTMLElement,
  node: Node | null,
  offset: number
): TextPoint | null {
  const block = blockElement(node)
  if (!block || !root.contains(block) || !block.dataset.block) return null
  const text = (block.textContent ?? "").replaceAll("\u200b", "")
  const raw = node?.nodeType === Node.TEXT_NODE ? offset : 0
  return {
    blockId: block.dataset.block,
    offset: Math.max(0, Math.min(raw, text.length)),
  }
}

function spanFrom(root: HTMLElement, fallback: TextPoint): TextSpan {
  const selection = root.ownerDocument.getSelection()
  if (!selection || selection.rangeCount === 0) return pointSpan(fallback)
  const anchor = pointFrom(root, selection.anchorNode, selection.anchorOffset)
  const focus = pointFrom(root, selection.focusNode, selection.focusOffset)
  if (!anchor || !focus) return pointSpan(fallback)
  return { anchor, focus }
}

function readBlocks(root: HTMLElement, nextId: number) {
  let minted = nextId
  const texts = [...root.querySelectorAll(":scope > p")].map((block) => {
    let id = block.dataset.block
    if (!id) {
      id = `p${minted}`
      minted += 1
      block.dataset.block = id
    }
    return {
      id,
      text: (block.textContent ?? "").replaceAll("\u200b", ""),
    }
  })
  return { texts, nextId: minted }
}

function blockSelector(id: string) {
  return `p[data-block="${id.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"]`
}

function withCommittedWord(
  texts: { id: string; text: string }[],
  blockId: string,
  word: string
) {
  if (!word) return texts
  const index = texts.findIndex((item) => item.id === blockId)
  const block = texts[index]
  if (!block || block.text.length > 0) return texts
  const next = texts.slice()
  next[index] = { id: block.id, text: word }
  return next
}

function syncParagraphs(root: HTMLElement, blocks: WritingBlock[]) {
  const nodes = [...root.querySelectorAll<HTMLElement>(":scope > p")]
  blocks.forEach((block, index) => {
    let node = nodes[index]
    if (!node) {
      node = root.ownerDocument.createElement("p")
      root.appendChild(node)
    }
    node.dataset.block = block.id
    const text = visibleText(block.text)
    if (node.textContent !== text) node.textContent = text
  })
  nodes.slice(blocks.length).forEach((node) => node.remove())
}

function placeCaret(root: HTMLElement, caret: TextPoint) {
  const block = root.querySelector<HTMLElement>(blockSelector(caret.blockId))
  if (!block) return
  const text = block.firstChild
  if (!text) return
  const raw = text.textContent ?? ""
  const offset =
    raw === "\u200b" ? 0 : Math.max(0, Math.min(caret.offset, raw.length))
  const range = root.ownerDocument.createRange()
  range.setStart(text, offset)
  range.collapse(true)
  const selection = root.ownerDocument.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

export function WritingCanvas({ docId }: { docId: string }) {
  const pageRef = useRef<HTMLElement>(null)
  const composing = useRef(false)
  const splitAfter = useRef(false)
  const pasteGuard = useRef(false)
  const [state, dispatch] = useReducer(reduce, docId, (id) => {
    const present = loadDraft(id, localStorage) ?? blankDraft()
    return {
      past: [],
      present,
      note: keptOnThisComputer(),
    }
  })
  const nextId = useRef(state.present.nextId)

  useEffect(() => {
    const kept = storeDraft(docId, state.present, localStorage)
    nextId.current = state.present.nextId
    dispatch({
      type: "note",
      note: kept ? keptOnThisComputer() : clearedOnReload(),
    })
  }, [docId, state.present])

  useEffect(() => {
    pageRef.current?.focus()
  }, [])

  useLayoutEffect(() => {
    const page = pageRef.current
    if (!page || composing.current) return
    syncParagraphs(page, state.present.blocks)
    placeCaret(page, state.present.caret)
  }, [state.present])

  const applyPaste = useCallback(
    (text: string) => {
      const page = pageRef.current
      if (!page || pasteGuard.current) return
      pasteGuard.current = true
      dispatch({
        type: "paste",
        span: spanFrom(page, state.present.caret),
        text,
      })
      queueMicrotask(() => {
        pasteGuard.current = false
      })
    },
    [state.present]
  )

  useEffect(() => {
    const page = pageRef.current
    if (!page) return
    const onBefore = (event: Event) => {
      if (composing.current) return
      const input = event as InputEvent
      if (typeof input.inputType !== "string") return
      if (
        input.inputType === "insertCompositionText" ||
        input.inputType === "insertParagraph"
      ) {
        return
      }
      if (input.inputType === "insertFromPaste") {
        event.preventDefault()
        applyPaste(input.data ?? "")
        return
      }
      const span = spanFrom(page, state.present.caret)
      if (input.inputType === "insertText") {
        event.preventDefault()
        dispatch({ type: "insert", span, text: input.data ?? "" })
        return
      }
      if (input.inputType === "deleteContentBackward") {
        event.preventDefault()
        dispatch({ type: "backward", span })
        return
      }
      if (input.inputType === "deleteContentForward") {
        event.preventDefault()
        dispatch({ type: "forward", span })
      }
    }
    page.addEventListener("beforeinput", onBefore)
    return () => page.removeEventListener("beforeinput", onBefore)
  }, [applyPaste, state.present])

  return (
    <section aria-label="Writing" className="writing-sheet">
      <article
        ref={pageRef}
        className={cn("writing-page")}
        contentEditable
        suppressContentEditableWarning
        spellCheck
        aria-label="Page"
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            const native = event.nativeEvent
            if (native.isComposing || native.keyCode === 229) {
              splitAfter.current = true
              return
            }
            const page = pageRef.current
            if (!page) return
            dispatch({
              type: "split",
              span: spanFrom(page, state.present.caret),
            })
            return
          }
          if (
            (event.metaKey || event.ctrlKey) &&
            event.key.toLowerCase() === "z" &&
            !event.shiftKey
          ) {
            event.preventDefault()
            dispatch({ type: "undo" })
          }
        }}
        onCompositionStart={() => {
          composing.current = true
        }}
        onCompositionEnd={() => {
          composing.current = false
          const page = pageRef.current
          if (!page) return
          const read = readBlocks(page, nextId.current)
          nextId.current = read.nextId
          const selected =
            pointFrom(
              page,
              page.ownerDocument.getSelection()?.focusNode ?? null,
              page.ownerDocument.getSelection()?.focusOffset ?? 0
            ) ?? state.present.caret
          const grew = read.texts.length > state.present.blocks.length
          const split = splitAfter.current && !grew
          splitAfter.current = false
          const texts = withCommittedWord(
            read.texts,
            selected.blockId,
            event.data
          )
          const block =
            texts.find((item) => item.id === selected.blockId) ?? texts[0]
          const caret = split
            ? {
                blockId: block?.id ?? selected.blockId,
                offset: block?.text.length ?? 0,
              }
            : selected
          dispatch({
            type: "composed",
            texts,
            caret,
            split,
            nextId: read.nextId,
          })
        }}
        onPaste={(event) => {
          event.preventDefault()
          applyPaste(event.clipboardData.getData("text/plain"))
        }}
      >
        {state.present.blocks.map((block) => (
          <p key={block.id} data-block={block.id}>
            {visibleText(block.text)}
          </p>
        ))}
      </article>
      <p className="writing-note" role="status">
        {state.note}
      </p>
    </section>
  )
}
