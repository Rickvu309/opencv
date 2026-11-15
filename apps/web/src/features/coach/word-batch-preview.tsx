import { Card, CardContent, CardTitle } from "@workspace/ui/components/card"

import { DiffDelete, DiffInsert } from "@/features/coach/rich-receipts.tsx"
import { wordChangeRows, type WordBatchView } from "@/lib/writing-proposal.ts"

const titles = {
  setText: "Change a line",
  insert: "Add a line",
  delete: "Remove a line",
} as const

const rowLook: Record<string, "insert" | "delete" | undefined> = {
  Before: "delete",
  Line: "delete",
  After: "insert",
  "New line": "insert",
}

const shownLabel: Record<string, string> = {
  Before: "Before",
  After: "After",
  Line: "Remove",
  Where: "Where",
  "New line": "Add",
}

export function WordBatchPreview({ batch }: { batch: WordBatchView }) {
  if (batch.state === "none") return null
  if (batch.state === "withheld")
    return (
      <p
        role="status"
        className="text-sm leading-relaxed text-muted-foreground"
      >
        {batch.reason}
      </p>
    )
  return (
    <Card className="gap-2 rounded-none bg-transparent ring-0 [--card-spacing:0px]">
      <CardTitle className="sr-only">Changes to approve</CardTitle>
      <CardContent>
        <ol className="space-y-3">
          {batch.changes.map((change, index) =>
            change.op === "replace" ? null : (
              <li key={index} className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  {titles[change.op]}
                </p>
                <dl
                  data-slot="word-change-rows"
                  className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-x-2 gap-y-1 font-sans text-sm leading-relaxed [overflow-wrap:anywhere] text-foreground"
                >
                  {wordChangeRows(change).map((row) => (
                    <div key={row.label} className="contents">
                      <dt className="pt-0.5 text-xs leading-5 text-muted-foreground">
                        {shownLabel[row.label] ?? row.label}
                      </dt>
                      <dd className="min-w-0 whitespace-pre-wrap">
                        {rowLook[row.label] === "insert" ? (
                          <DiffInsert>{row.text}</DiffInsert>
                        ) : rowLook[row.label] === "delete" ? (
                          <DiffDelete>{row.text}</DiffDelete>
                        ) : (
                          <span className="text-muted-foreground">
                            {row.text}
                          </span>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </li>
            )
          )}
        </ol>
      </CardContent>
    </Card>
  )
}
