import {
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type KeyboardEvent,
} from "react"
import {
  compactLetterDocument,
  type LetterDocument,
  type LetterPart,
} from "@workspace/domain"
import { Textarea } from "@workspace/ui/components/textarea"

import "./design/letter-sheet.pen.css"
import {
  editParagraph,
  mergeParagraph,
  paragraphsOf,
  saveBody,
  splitParagraph,
  type BodyPosition,
  type ParagraphEdit,
} from "./letter-sheet-model.ts"

type LetterSheetProps = {
  letter: LetterDocument
  mode: "read" | "edit"
  onChange?: (letter: LetterDocument) => void
}

const PART_FIELDS: Record<
  LetterPart,
  { label: string; placeholder: string; multiline: boolean }
> = {
  sender: { label: "Sender name", placeholder: "Your name", multiline: false },
  contact: {
    label: "Contact details",
    placeholder: "Email, phone, city",
    multiline: false,
  },
  date: { label: "Date", placeholder: "Date", multiline: false },
  recipient: {
    label: "Recipient",
    placeholder: "Recipient and company",
    multiline: true,
  },
  salutation: {
    label: "Salutation",
    placeholder: "Dear Hiring Team,",
    multiline: false,
  },
  closing: { label: "Closing", placeholder: "Sincerely,", multiline: false },
  signature: {
    label: "Signature",
    placeholder: "Your name",
    multiline: false,
  },
}

const BEFORE_BODY: LetterPart[] = [
  "sender",
  "contact",
  "date",
  "recipient",
  "salutation",
]
const AFTER_BODY: LetterPart[] = ["closing", "signature"]

function fieldSizingSupported() {
  return (
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    CSS.supports("field-sizing", "content")
  )
}

/** The kit Textarea, grown to its content where field-sizing is missing. */
function SheetField({ ref, ...props }: ComponentProps<typeof Textarea>) {
  const node = useRef<HTMLTextAreaElement | null>(null)
  useLayoutEffect(() => {
    const element = node.current
    if (!element || fieldSizingSupported()) return
    let width = -1
    const fit = () => {
      width = element.clientWidth
      element.style.height = "auto"
      if (element.scrollHeight > 0)
        element.style.height = `${element.scrollHeight}px`
    }
    // Where the browser cannot size the field, never hide the last lines: the
    // field scrolls if a rewrap or a late font load outgrows the fitted height.
    element.style.overflowY = "auto"
    fit()
    const observer =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(() => {
            if (element.clientWidth !== width) fit()
          })
        : null
    observer?.observe(element)
    void document.fonts?.ready?.then(fit)
    return () => observer?.disconnect()
  }, [props.value])
  return (
    <Textarea
      {...props}
      rows={1}
      ref={(element) => {
        node.current = element
        if (typeof ref === "function") ref(element)
        else if (ref) ref.current = element
      }}
    />
  )
}

function composing(event: KeyboardEvent) {
  return event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229
}

function oneLine(value: string) {
  return value.replace(/\r?\n/g, " ")
}

function ReadSheet({ letter }: { letter: LetterDocument }) {
  const shown = compactLetterDocument(letter)
  const paragraphs =
    shown.markdown.trim() === "" ? [] : paragraphsOf(shown.markdown)
  const part = (name: LetterPart) =>
    shown[name] === undefined ? null : (
      <p key={name} data-slot={`letter-${name}`}>
        {shown[name]}
      </p>
    )
  return (
    <div data-pen-surface="paper" data-slot="letter-sheet" data-mode="read">
      {BEFORE_BODY.map(part)}
      {paragraphs.map((text, index) => (
        <p key={index} data-slot="letter-paragraph">
          {text}
        </p>
      ))}
      {AFTER_BODY.map(part)}
    </div>
  )
}

function EditSheet({
  letter,
  onChange,
}: {
  letter: LetterDocument
  onChange?: (letter: LetterDocument) => void
}) {
  const fields = useRef<(HTMLTextAreaElement | null)[]>([])
  const pending = useRef<BodyPosition | null>(null)
  const parts = useRef<Partial<Record<LetterPart, HTMLTextAreaElement | null>>>(
    {}
  )
  const partCaret = useRef<{ part: LetterPart; offset: number } | null>(null)
  const softBreak = useRef(false)
  // The paragraphs on screen are the source of truth while editing. The body
  // string is derived from them, so a line break at a paragraph's end stays
  // where the writer typed it. They are read again from the string only when
  // it changed from outside (a reload, the keyword card).
  const [view, setView] = useState(() => ({
    paragraphs: paragraphsOf(letter.markdown),
    known: letter.markdown,
  }))
  let current = view
  if (letter.markdown !== view.known) {
    current = {
      paragraphs: paragraphsOf(letter.markdown),
      known: letter.markdown,
    }
    setView(current)
  }
  const paragraphs = current.paragraphs

  useLayoutEffect(() => {
    // A pasted line break in a one-line part becomes a space; keep the caret
    // where the text went in instead of letting the controlled value reset it.
    const kept = partCaret.current
    if (kept) {
      partCaret.current = null
      const field = parts.current[kept.part]
      if (field && document.activeElement === field)
        field.setSelectionRange(kept.offset, kept.offset)
    }
    const target = pending.current
    if (!target) return
    pending.current = null
    const element = fields.current[target.index]
    if (!element) return
    element.focus()
    element.setSelectionRange(target.offset, target.offset)
  })

  const apply = (edit: ParagraphEdit) => {
    const body = saveBody(edit.paragraphs)
    if (edit.caret) pending.current = edit.caret
    setView({ paragraphs: edit.paragraphs, known: body })
    onChange?.({ ...letter, markdown: body })
  }

  const keyParagraph = (
    index: number,
    event: KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (composing(event)) return
    const element = event.currentTarget
    const start = element.selectionStart
    const end = element.selectionEnd
    // Shift+Enter is the browser's own line break, in every position. The
    // change it causes is flagged so that it never reads as a paragraph break.
    softBreak.current = event.key === "Enter" && event.shiftKey
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      apply(splitParagraph(paragraphs, index, start, end))
      return
    }
    const collapsed = start === end
    let merge: number | null = null
    if (event.key === "Backspace" && collapsed && start === 0 && index > 0)
      merge = index
    if (
      event.key === "Delete" &&
      collapsed &&
      start === element.value.length &&
      index < paragraphs.length - 1
    )
      merge = index + 1
    if (merge === null) return
    event.preventDefault()
    apply(mergeParagraph(paragraphs, merge))
  }

  const part = (name: LetterPart) => {
    const field = PART_FIELDS[name]
    return (
      <SheetField
        key={name}
        ref={(element) => {
          parts.current[name] = element
        }}
        data-slot={`letter-${name}`}
        aria-label={field.label}
        placeholder={field.placeholder}
        value={letter[name] ?? ""}
        onChange={(event) => {
          const raw = event.target.value
          const value = field.multiline ? raw : oneLine(raw)
          if (value !== raw)
            partCaret.current = {
              part: name,
              offset: event.target.selectionStart,
            }
          onChange?.({ ...letter, [name]: value })
        }}
        onKeyDown={(event) => {
          if (field.multiline || composing(event)) return
          if (event.key === "Enter") event.preventDefault()
        }}
      />
    )
  }

  return (
    <div data-pen-surface="paper" data-slot="letter-sheet" data-mode="edit">
      {BEFORE_BODY.map(part)}
      {paragraphs.map((text, index) => (
        <SheetField
          key={index}
          ref={(element) => {
            fields.current[index] = element
          }}
          data-slot="letter-paragraph"
          aria-label={`Paragraph ${index + 1}`}
          placeholder={index === 0 ? "Write the first paragraph" : undefined}
          value={text}
          onChange={(event) => {
            const soft =
              softBreak.current ||
              (event.nativeEvent as InputEvent).inputType === "insertLineBreak"
            softBreak.current = false
            apply(
              editParagraph(
                paragraphs,
                index,
                event.target.value,
                event.target.selectionStart,
                soft
              )
            )
          }}
          onKeyDown={(event) => keyParagraph(index, event)}
        />
      ))}
      {AFTER_BODY.map(part)}
    </div>
  )
}

/**
 * One letter sheet for every surface. Read mode shows the filled parts and the
 * body paragraphs. Edit mode adds a field per part and per paragraph.
 */
export function LetterSheet({ letter, mode, onChange }: LetterSheetProps) {
  if (mode === "read") return <ReadSheet letter={letter} />
  return <EditSheet letter={letter} onChange={onChange} />
}
