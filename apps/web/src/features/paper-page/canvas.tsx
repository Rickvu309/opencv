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
  type WritingBlock,
  type WritingDraft,
} from "./canvas-edit.ts"
import { pastePlain } from "./canvas-paste.ts"
import { pageWords, savedNote, settlePage } from "./canvas-save.ts"
import "./canvas.css"

type CanvasState = {
  past: WritingDraft[]
  present: WritingDraft
  note: string
}

type CanvasAction =
  | {
      type: "insert"
      span: TextSpan
      text: string
      live?: { id: string; text: string }[]
      nextId?: number
    }
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
    note: state.note === "Saved" ? keptOnThisComputer() : state.note,
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
  const base =
    action.type === "insert" && action.live
      ? replaceVisible(
          { ...state.present, nextId: action.nextId ?? state.present.nextId },
          action.live,
          span.anchor
        )
      : state.present
  const present =
    action.type === "insert"
      ? insertText(base, span, action.text)
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
  const texts = [...root.querySelectorAll<HTMLElement>(":scope > p")].map(
    (block) => {
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
    }
  )
  return { texts, nextId: minted }
}

function blockSelector(id: string) {
  return `p[data-block="${id.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"]`
}

function withCommittedWord(
  texts: { id: string; text: string }[],
  blockId: string,
  word: string,
  base: { text: string; offset: number } | null
) {
  if (!word) return texts
  const index = texts.findIndex((item) => item.id === blockId)
  const block = texts[index]
  if (!block) return texts
  if (base && block.text !== base.text) return texts
  const at = Math.max(
    0,
    Math.min(base ? base.offset : block.text.length, block.text.length)
  )
  const next = texts.slice()
  next[index] = {
    id: block.id,
    text: block.text.slice(0, at) + word + block.text.slice(at),
  }
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

function revealCaret(page: HTMLElement, scroll: HTMLElement) {
  const node = page.ownerDocument.getSelection()?.focusNode
  const target =
    node?.nodeType === Node.TEXT_NODE
      ? node.parentElement
      : (node as HTMLElement | null)
  if (!target) return
  const caretBox = target.getBoundingClientRect()
  const frame = scroll.getBoundingClientRect()
  if (caretBox.top >= frame.top && caretBox.bottom <= frame.bottom) return
  target.scrollIntoView({ block: "nearest" })
}

function WritingSheet({
  docId,
  seed,
}: {
  docId: string
  seed: WritingDraft | null
}) {
  const pageRef = useRef<HTMLElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const opened = useRef(false)
  const composing = useRef(false)
  const splitAfter = useRef(false)
  const pasteGuard = useRef(false)
  const compositionBase = useRef<{
    blockId: string
    text: string
    offset: number
  } | null>(null)
  const [state, dispatch] = useReducer(reduce, null, () => {
    const present = loadDraft(docId, localStorage) ?? seed ?? blankDraft()
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
    const fallback = kept ? keptOnThisComputer() : clearedOnReload()
    dispatch({ type: "note", note: fallback })
    if (!kept) return
    const controller = new AbortController()
    const words = pageWords(state.present.blocks)
    void settlePage(docId, words, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return
        const note = savedNote(words, result)
        if (!note) return
        dispatch({ type: "note", note })
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [docId, state.present])

  useLayoutEffect(() => {
    const page = pageRef.current
    const scroll = scrollRef.current
    if (!page || composing.current) return
    syncParagraphs(page, state.present.blocks)
    if (!opened.current) {
      page.focus({ preventScroll: true })
      if (scroll) scroll.scrollTop = 0
      opened.current = true
    }
    placeCaret(page, state.present.caret)
    if (scroll) revealCaret(page, scroll)
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
        const live = readBlocks(page, state.present.nextId)
        dispatch({
          type: "insert",
          span,
          text: input.data ?? "",
          live: live.texts,
          nextId: live.nextId,
        })
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
      <div className="writing-scroll" ref={scrollRef}>
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
            const caret = state.present.caret
            const block = state.present.blocks.find(
              (item) => item.id === caret.blockId
            )
            compositionBase.current = {
              blockId: caret.blockId,
              text: block?.text ?? "",
              offset: caret.offset,
            }
          }}
          onCompositionEnd={(event) => {
            composing.current = false
            const page = pageRef.current
            const base = compositionBase.current
            compositionBase.current = null
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
            const target =
              base && read.texts.some((item) => item.id === base.blockId)
                ? base.blockId
                : selected.blockId
            const texts = withCommittedWord(
              read.texts,
              target,
              event.data,
              base && base.blockId === target ? base : null
            )
            const block = texts.find((item) => item.id === target) ?? texts[0]
            const caret = split
              ? {
                  blockId: block?.id ?? target,
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
      </div>
      <p className="writing-note" role="status">
        {state.note}
      </p>
    </section>
  )
}

export function WritingCanvas({
  docId,
  seed = null,
}: {
  docId: string
  seed?: WritingDraft | null
}) {
  return <WritingSheet key={docId} docId={docId} seed={seed} />
}
