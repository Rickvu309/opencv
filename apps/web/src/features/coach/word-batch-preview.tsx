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
      <CardTitle className="text-xs font-medium text-muted-foreground">
        Changes to approve
      </CardTitle>
      <CardContent>
        <ol className="space-y-2">
          {batch.changes.map((change, index) =>
            change.op === "replace" ? null : (
              <li key={index} className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  {titles[change.op]}
                </p>
                <div className="space-y-1 font-sans text-sm leading-relaxed [overflow-wrap:anywhere] text-foreground">
                  {wordChangeRows(change).map((row) => (
                    <p key={row.label} className="whitespace-pre-wrap">
                      <span className="sr-only">{row.label}: </span>
                      {rowLook[row.label] === "insert" ? (
                        <DiffInsert>{row.text}</DiffInsert>
                      ) : rowLook[row.label] === "delete" ? (
                        <DiffDelete>{row.text}</DiffDelete>
                      ) : (
                        <span className="text-muted-foreground">
                          {row.text}
                        </span>
                      )}
                    </p>
                  ))}
                </div>
              </li>
            )
          )}
        </ol>
      </CardContent>
    </Card>
  )
}
