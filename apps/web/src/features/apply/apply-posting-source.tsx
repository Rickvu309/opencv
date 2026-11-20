import { Link as LinkIcon } from "lucide-react"

import { openableApplyJobUrl, type JobDetail } from "@workspace/domain"

export function PostingSource({
  jobUrl,
  sourceHost,
}: Pick<JobDetail, "jobUrl" | "sourceHost">) {
  const source = sourceHost || jobUrl
  if (!source) return null

  const sourceUrl = openableApplyJobUrl(jobUrl)
  const label = (
    <>
      <LinkIcon
        aria-hidden
        className="size-3.5 shrink-0 text-muted-foreground"
      />
      <span className="truncate">{source}</span>
    </>
  )

  return sourceUrl ? (
    <a
      data-slot="property"
      href={sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-11 items-center gap-[9px] rounded-md px-2 text-ui text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:bg-muted md:h-8"
    >
      {label}
    </a>
  ) : (
    <div
      data-slot="property"
      className="flex h-8 items-center gap-[9px] px-2 text-ui text-foreground"
    >
      {label}
    </div>
  )
}
