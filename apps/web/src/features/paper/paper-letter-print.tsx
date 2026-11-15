import { Fragment } from "react"
import { createPortal } from "react-dom"
import {
  letterPrintModel,
  type LetterPaper,
  type LetterPrintList,
  type RichText,
} from "@workspace/domain"

import "./design/letter-sheet.pen.css"

function Runs({ text }: { text: RichText }) {
  return (
    <>
      {text.map((run, index) => {
        let node = <>{run.text}</>
        if (run.bold) node = <strong>{node}</strong>
        if (run.italic) node = <em>{node}</em>
        if (run.underline) node = <u>{node}</u>
        if (run.href) node = <a href={run.href}>{node}</a>
        return <Fragment key={index}>{node}</Fragment>
      })}
    </>
  )
}

function ListView({ list }: { list: LetterPrintList }) {
  const Tag = list.ordered ? "ol" : "ul"
  return (
    <Tag>
      {list.items.map((item, index) => (
        <li key={index}>
          <Runs text={item.text} />
          {item.lists.map((inner, at) => (
            <ListView key={at} list={inner} />
          ))}
        </li>
      ))}
    </Tag>
  )
}

export function LetterPrintView({ document }: { document: LetterPaper }) {
  const model = letterPrintModel(document)
  return (
    <div data-pen-surface="paper" data-slot="letter-sheet">
      {model.fragments.map((fragment, index) => {
        if (fragment.kind === "divider") return <hr key={index} />
        if (fragment.kind === "list") {
          return (
            <div key={index} data-slot="letter-paragraph">
              <ListView list={fragment.list} />
            </div>
          )
        }
        const Tag =
          fragment.kind === "heading"
            ? fragment.level === 3
              ? "h3"
              : "h2"
            : "p"
        return (
          <Tag key={index} data-slot="letter-paragraph">
            <Runs text={fragment.text} />
          </Tag>
        )
      })}
    </div>
  )
}

export function LetterPrint({ document }: { document: LetterPaper }) {
  const host = globalThis.document
  if (!host) return null
  return createPortal(
    <article
      data-paper-print=""
      data-paper-letter=""
      className="paper-print-sheet"
      aria-hidden="true"
      inert
    >
      <LetterPrintView document={document} />
    </article>,
    host.body
  )
}
