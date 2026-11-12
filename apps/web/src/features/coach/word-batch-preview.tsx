import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { wordChangeRows, type WordBatchView } from "@/lib/writing-proposal.ts"

const titles = {
  setText: "Change a line",
  insert: "Add a line",
  delete: "Remove a line",
} as const

export function WordBatchPreview({ batch }: { batch: WordBatchView }) {
  if (batch.state === "none") return null
  if (batch.state === "withheld") return <p>{batch.reason}</p>
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>This change</CardTitle>
      </CardHeader>
      <CardContent>
        <ol>
          {batch.changes.map((change, index) =>
            change.op === "replace" ? null : (
              <li key={index}>
                <p>{titles[change.op]}</p>
                {wordChangeRows(change).map((row) => (
                  <p key={row.label}>
                    {row.label === "Where"
                      ? row.text
                      : `${row.label} ${row.text}`}
                  </p>
                ))}
              </li>
            )
          )}
        </ol>
      </CardContent>
    </Card>
  )
}
