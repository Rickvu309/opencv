import { Button, buttonVariants } from "@workspace/ui/components/button"
import { CopyButton } from "@workspace/ui/components/copy-button"

export type UnsavedLine = { id: string; text: string; note: string }

export type UnsavedBarProps = {
  moved: { dropped: number; onKeep: () => void; onUseSaved: () => void } | null
  page: { reason: string; signIn: boolean; unsavedText: () => string } | null
  lines: UnsavedLine[]
  onRestore: (id: string) => void
}

function preview(text: string) {
  const plain = text.trim()
  if (plain === "") return "an empty line"
  const short = plain.split(/\s+/).slice(0, 6).join(" ")
  return short === plain ? `“${plain}”` : `“${short}…”`
}

function lines(count: number) {
  return count === 1 ? "1 line" : `${count} lines`
}

function summary({ moved, page, lines: refused }: UnsavedBarProps) {
  if (moved)
    return "This page was changed somewhere else. Your words are still here and are not saved."
  if (page) return `This page can't be saved. ${page.reason}`
  if (refused.length > 0)
    return `${lines(refused.length)} could not be saved. Your words are still here.`
  return ""
}

export function UnsavedBar(props: UnsavedBarProps) {
  const { moved, page, lines: refused, onRestore } = props
  const showLines = !moved && !page && refused.length > 0
  const open = moved !== null || page !== null || showLines
  return (
    <>
      <p className="sr-only" aria-live="polite">
        {summary(props)}
      </p>
      {open ? (
        <section aria-label="Unsaved words" className="writing-unsaved">
          {moved ? (
            <div className="writing-unsaved-row">
              <p className="writing-unsaved-text">
                <span className="writing-unsaved-title">
                  This page was changed somewhere else.
                </span>{" "}
                Your words are still here and are not saved. Keep them on top of
                the newer page, or use the saved page. Using the saved page
                drops your changes on {lines(moved.dropped)}.
              </p>
              <div className="writing-unsaved-actions">
                <Button size="sm" variant="outline" onClick={moved.onKeep}>
                  Keep my words
                </Button>
                <Button size="sm" variant="ghost" onClick={moved.onUseSaved}>
                  Use the saved page
                </Button>
              </div>
            </div>
          ) : null}
          {page && !moved ? (
            <div className="writing-unsaved-row">
              <p className="writing-unsaved-text">
                <span className="writing-unsaved-title">
                  This page can't be saved.
                </span>{" "}
                {page.reason} Your words are still on this page and on this
                computer.
              </p>
              <div className="writing-unsaved-actions">
                <CopyButton
                  size="sm"
                  variant="outline"
                  aria-label="Copy all my unsaved text"
                  value={page.unsavedText}
                >
                  Copy all my unsaved text
                </CopyButton>
                {page.signIn ? (
                  <a
                    className={buttonVariants({ size: "sm", variant: "ghost" })}
                    href="/sign-in"
                    target="_blank"
                    rel="noopener"
                  >
                    Sign in again
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}
          {showLines
            ? refused.map((line) => (
                <div key={line.id} className="writing-unsaved-row">
                  <p className="writing-unsaved-text">
                    <span className="writing-unsaved-title">
                      {preview(line.text)} is not saved.
                    </span>{" "}
                    {line.note}
                  </p>
                  <div className="writing-unsaved-actions">
                    <CopyButton
                      size="sm"
                      variant="outline"
                      aria-label={`Copy my text from ${preview(line.text)}`}
                      value={line.text}
                    >
                      Copy my text
                    </CopyButton>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Restore this line: ${preview(line.text)}`}
                      onClick={() => onRestore(line.id)}
                    >
                      Restore this line
                    </Button>
                  </div>
                </div>
              ))
            : null}
        </section>
      ) : null}
    </>
  )
}
