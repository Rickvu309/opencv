import { PageHeaderTitle } from "@workspace/ui/components/page-header"

import { ComingSoonPage } from "@/features/coming-soon/coming-soon-page.tsx"
import { soonCopy } from "@/features/coming-soon/copy.ts"
import { PitchHeroArt } from "@/features/coming-soon/pitch-hero-art.tsx"

export function PitchPage() {
  return (
    <ComingSoonPage
      header={<PageHeaderTitle>{soonCopy.pitchPage}</PageHeaderTitle>}
      title={soonCopy.pitchTitle}
      body={soonCopy.pitchBody}
      topic="pitch"
      preview={<PitchHeroArt />}
    />
  )
}
