import { ComingSoonPage } from "@/features/coming-soon/coming-soon-page.tsx"
import { soonCopy } from "@/features/coming-soon/copy.ts"
import { JobsPreview } from "@/features/coming-soon/jobs-preview.tsx"
import { PitchPreview } from "@/features/coming-soon/pitch-preview.tsx"
import { ProofPreview } from "@/features/coming-soon/proof-preview.tsx"

export function JobsPage() {
  return (
    <ComingSoonPage
      pageTitle={soonCopy.jobsPage}
      title={soonCopy.jobsTitle}
      body={soonCopy.jobsBody}
      primary={{ label: soonCopy.notify, topic: "jobs" }}
      secondary={{ label: soonCopy.track, to: "/app/apply" }}
      preview={<JobsPreview />}
    />
  )
}

export function ProofsPage() {
  return (
    <ComingSoonPage
      pageTitle={soonCopy.proofsPage}
      title={soonCopy.proofTitle}
      body={soonCopy.proofBody}
      primary={{ label: soonCopy.earlyAccess, topic: "proof" }}
      preview={<ProofPreview />}
    />
  )
}

export function PitchPage() {
  return (
    <ComingSoonPage
      pageTitle={soonCopy.pitchPage}
      title={soonCopy.pitchTitle}
      body={soonCopy.pitchBody}
      primary={{ label: soonCopy.earlyAccess, topic: "pitch" }}
      preview={<PitchPreview />}
    />
  )
}
