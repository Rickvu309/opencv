import type { PitchDocument, ProofDocument } from "@workspace/domain"

import {
  AboutSection,
  AchievementsSection,
  ContactSection,
  ExperienceSection,
  GallerySection,
  GithubSection,
  WorkSection,
} from "@/features/pitch/pitch-showcase.tsx"
import { MomentsBentoSection } from "@/features/pitch/pitch-moments.tsx"
import {
  overlayPitchBento,
  overlayPitchLinks,
  type PitchBlock,
  type PitchProfile,
} from "@/features/pitch/pitch-types.ts"

export function PitchSection({
  block,
  profile,
  editing,
  content,
  bento,
  links,
  onHide,
  onAboutChange,
  onOpenStory,
  onOpenProof,
  onAddAchievement,
}: {
  block: PitchBlock
  profile: PitchProfile
  editing: boolean
  content: PitchDocument
  bento: ReturnType<typeof overlayPitchBento>
  links: ReturnType<typeof overlayPitchLinks>
  onHide?: () => void
  onAboutChange?: (text: string) => void
  onOpenStory: (highlightId: string) => void
  onOpenProof: (proof: ProofDocument) => void
  onAddAchievement?: () => void
}) {
  switch (block.kind) {
    case "moments":
      return (
        <MomentsBentoSection
          cards={bento}
          editing={editing}
          onHide={onHide}
          onOpenStory={onOpenStory}
        />
      )
    case "about":
      return (
        <AboutSection
          text={profile.about}
          editing={editing}
          onHide={onHide}
          onChange={onAboutChange}
        />
      )
    case "achievements":
      return (
        <AchievementsSection
          items={content.achievements}
          editing={editing}
          onHide={onHide}
          onOpenProof={onOpenProof}
          onAdd={onAddAchievement}
        />
      )
    case "experience":
      return (
        <ExperienceSection
          items={content.experience}
          editing={editing}
          onHide={onHide}
        />
      )
    case "work":
      return (
        <WorkSection
          files={content.files}
          workDocs={content.workDocs}
          editing={editing}
          onHide={onHide}
        />
      )
    case "github":
      return (
        <GithubSection profile={profile} editing={editing} onHide={onHide} />
      )
    case "contact":
      return <ContactSection links={links} editing={editing} onHide={onHide} />
    case "gallery":
      return (
        <GallerySection
          items={content.gallery}
          editing={editing}
          onHide={onHide}
        />
      )
    default:
      return null
  }
}
