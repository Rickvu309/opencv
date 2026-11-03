import {
  withoutBlankParts,
  type LetterDocument,
  type LetterPart,
} from "@workspace/domain"

import "./design/letter-sheet.pen.css"
import { paragraphsOf } from "./letter-sheet-model.ts"

const BEFORE_BODY: LetterPart[] = [
  "sender",
  "contact",
  "date",
  "recipient",
  "salutation",
]
const AFTER_BODY: LetterPart[] = ["closing", "signature"]

export function LetterSheet({ letter }: { letter: LetterDocument }) {
  const shown = withoutBlankParts(letter)
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
