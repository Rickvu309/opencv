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
  if (batch.state === "withheld") return <p role="status">{batch.reason}</p>
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Changes to approve</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col gap-2">
          {batch.changes.map((change, index) =>
            change.op === "replace" ? null : (
              <li key={index} className="flex flex-col gap-1">
                <p className="font-medium text-foreground">
                  {titles[change.op]}
                </p>
                <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
                  {wordChangeRows(change).map((row) => (
                    <div key={row.label} className="contents">
                      <dt>{row.label}</dt>
                      <dd className="min-w-0 [overflow-wrap:anywhere] text-foreground">
                        {row.text}
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
