import { useId, useReducer } from "react"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { CopyButton } from "@workspace/ui/components/copy-button"

import type { LineRefusal } from "./canvas-save-lines.ts"
import type { UnsavedBarModel } from "./canvas-unsaved.ts"

export type UnsavedBarProps = {
  model: UnsavedBarModel
  onUseSaved: () => void
  onRestore: (id: string) => void
}

type DetailAction = { type: "toggle" } | { type: "close" }

function detailReducer(open: boolean, action: DetailAction) {
  return action.type === "toggle" ? !open : false
}

function preview(text: string) {
  const plain = text.trim()
  if (plain === "") return "an empty line"
  const short = plain.split(/\s+/).slice(0, 6).join(" ")
  return short === plain ? `“${plain}”` : `“${short}…”`
}

function lineCount(count: number) {
  return count === 1 ? "1 line" : `${count} lines`
}

function lineTitle(line: LineRefusal) {
  return line.removed
    ? `Removing ${preview(line.text)} is not saved.`
    : `${preview(line.text)} is not saved.`
}

function message(model: UnsavedBarModel): [string, string] {
  if (model.cause === "moved")
    return [
      "This page was changed somewhere else.",
      "Your words are still here and are not saved.",
    ]
  if (model.cause === "page")
    return [
      "This page can't be saved.",
      `${model.reason ?? ""} Your words are still here and on this computer.`,
    ]
  const only = model.lines.length === 1 ? model.lines[0] : undefined
  if (only) return [lineTitle(only), only.note]
  return [
    `${lineCount(model.lines.length)} are not saved.`,
    "Your words are still here.",
  ]
}

function LineActions({
  line,
  onRestore,
}: {
  line: LineRefusal
  onRestore: (id: string) => void
}) {
  return (
    <>
      {line.removed ? null : (
        <CopyButton
          size="sm"
          className="h-11 md:h-7"
          variant="outline"
          aria-label={`Copy my text from ${preview(line.text)}`}
          value={line.text}
        >
          Copy my text
        </CopyButton>
      )}
      <Button
        size="sm"
        className="h-11 md:h-7"
        variant="ghost"
        aria-label={`Restore this line: ${preview(line.text)}`}
        onClick={() => onRestore(line.id)}
      >
        Restore this line
      </Button>
    </>
  )
}

function Actions({ model, onUseSaved, onRestore }: UnsavedBarProps) {
  if (model.cause === "moved")
    return (
      <>
        <CopyButton
          size="sm"
          className="h-11 md:h-7"
          variant="outline"
          aria-label="Copy my unsaved text"
          value={() => model.unsavedText}
        >
          Copy my unsaved text
        </CopyButton>
        <Button
          size="sm"
          className="h-11 md:h-7"
          variant="ghost"
          aria-label={`Use the saved page, discards ${lineCount(model.discards)}`}
          onClick={onUseSaved}
        >
          Use the saved page
          <span className="writing-unsaved-count">
            discards {lineCount(model.discards)}
          </span>
        </Button>
      </>
    )
  if (model.cause === "page")
    return (
      <>
        <CopyButton
          size="sm"
          className="h-11 md:h-7"
          variant="outline"
          aria-label="Copy all my unsaved text"
          value={() => model.unsavedText}
        >
          Copy all my unsaved text
        </CopyButton>
        {model.signIn ? (
          <a
            className={buttonVariants({
              size: "sm",
              variant: "ghost",
              className: "h-11 md:h-7",
            })}
            href="/sign-in"
            target="_blank"
            rel="noopener"
          >
            Sign in again
          </a>
        ) : null}
      </>
    )
  const only = model.lines.length === 1 ? model.lines[0] : undefined
  return only ? <LineActions line={only} onRestore={onRestore} /> : null
}

function summary(model: UnsavedBarModel) {
  if (!model.cause) return ""
  const [title, body] = message(model)
  return `${title} ${body}`
}

export function UnsavedBar(props: UnsavedBarProps) {
  const { model, onRestore } = props
  const [open, detail] = useReducer(detailReducer, false)
  const detailId = useId()
  const listed =
    model.lines.length > 0 &&
    (model.cause !== "lines" || model.lines.length > 1)
  const [title, body] = model.cause ? message(model) : ["", ""]
  return (
    <>
      <p className="sr-only" aria-live="polite">
        {summary(model)}
      </p>
      {model.cause ? (
        <section
          aria-label="Unsaved words"
          className="writing-unsaved"
          data-cause={model.cause}
        >
          <div className="writing-unsaved-row">
            <p className="writing-unsaved-text" title={`${title} ${body}`}>
              <span className="writing-unsaved-title">{title}</span> {body}
            </p>
            <div className="writing-unsaved-actions">
              <Actions {...props} />
            </div>
            {listed ? (
              <Button
                size="sm"
                className="writing-unsaved-toggle h-11 md:h-7"
                variant="ghost"
                aria-expanded={open}
                aria-controls={detailId}
                onClick={() => detail({ type: "toggle" })}
              >
                {open ? "Hide lines" : `Show ${lineCount(model.lines.length)}`}
              </Button>
            ) : null}
          </div>
          {listed && open ? (
            <ul id={detailId} className="writing-unsaved-detail">
              {model.lines.map((line) => (
                <li key={line.id} className="writing-unsaved-line">
                  <p className="writing-unsaved-text">
                    <span className="writing-unsaved-title">
                      {lineTitle(line)}
                    </span>{" "}
                    {line.note}
                  </p>
                  <div className="writing-unsaved-actions">
                    <LineActions line={line} onRestore={onRestore} />
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </>
  )
}
