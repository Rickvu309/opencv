import { ComingSoonPage } from "@/features/coming-soon/coming-soon-page.tsx"
import { soonCopy } from "@/features/coming-soon/copy.ts"
import { JobsPreview } from "@/features/coming-soon/jobs-preview.tsx"

export function JobsPage() {
  return (
    <ComingSoonPage
      pageTitle={soonCopy.jobsPage}
      title={soonCopy.jobsTitle}
      body={soonCopy.jobsBody}
      primary={{ label: soonCopy.notify, topic: "jobs" }}
      secondary={{ label: soonCopy.track, to: "/apply" }}
      preview={<JobsPreview />}
    />
  )
}

export { PitchPage } from "@/features/coming-soon/pitch-page.tsx"
export { ProofsPage } from "@/features/coming-soon/proof-page.tsx"
