import { richReviewSchema, type RichChange } from "@workspace/domain"

const labels: Record<string, string> = {
  bold: "Bold",
  italic: "Italic",
  underline: "Underline",
  strike: "Strikethrough",
  color: "Text color",
  highlight: "Highlight",
  fontId: "Typeface",
  size: "Size",
  characterStyle: "Character style",
  href: "Link",
}

function Passage({ runs }: { runs: RichChange["before"] }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <p className="text-sm leading-relaxed [overflow-wrap:anywhere] whitespace-pre-wrap text-foreground">
        {runs.length ? runs.map((run) => run.text).join("") : "Empty passage"}
      </p>
      <ul className="space-y-1 text-xs leading-relaxed [overflow-wrap:anywhere] text-muted-foreground">
        {runs.map((run, index) => {
          const marks = Object.entries(run).filter(([key]) => key !== "text")
          return marks.length ? (
            <li key={index}>
              “{run.text}”:{" "}
              {marks
                .map(
                  ([key, value]) =>
                    `${labels[key] ?? key}${typeof value === "boolean" ? (value ? " on" : " off") : key === "size" && typeof value === "number" ? ` ${value / 20} pt` : ` ${value}`}`
                )
                .join(" · ")}
            </li>
          ) : null
        })}
      </ul>
    </div>
  )
}

export function RichPaperPreview({ review }: { review: unknown }) {
  const parsed = richReviewSchema.safeParse(review)
  if (!parsed.success)
    return (
      <p className="text-sm text-muted-foreground">
        Approve is unavailable because this change cannot be shown in full.
      </p>
    )
  return (
    <div
      data-slot="rich-paper-preview"
      className="min-w-0 space-y-4"
      aria-label="Proposed text and formatting"
    >
      {parsed.data.changes.map((change) => (
        <dl
          key={change.blockId}
          className="min-w-0 space-y-3 rounded-lg bg-muted/50 p-3"
        >
          <div className="min-w-0 space-y-1">
            <dt className="text-xs font-medium text-muted-foreground">
              Before
            </dt>
            <dd>
              <Passage runs={change.before} />
            </dd>
          </div>
          <div className="min-w-0 space-y-1">
            <dt className="text-xs font-medium text-muted-foreground">After</dt>
            <dd>
              <Passage runs={change.after} />
            </dd>
          </div>
        </dl>
      ))}
    </div>
  )
}
