import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  decodePitchContent,
  emptyPitchDocument,
  isGhostPitchDocument,
  isPitchPublicSlug,
  type ProofDocument,
} from "@workspace/domain"

import { NotFoundPage } from "@/components/not-found-page.tsx"
import { getPublicPitch, pitchQueryKeys } from "@/features/pitch/pitch-api.ts"
import { PitchProofViewer } from "@/features/pitch/pitch-proof-viewer.tsx"
import { PitchSection } from "@/features/pitch/pitch-sections.tsx"
import { PitchProfileHeader } from "@/features/pitch/pitch-showcase.tsx"
import {
  PitchStoryViewer,
  StoryHighlightsRow,
} from "@/features/pitch/pitch-stories.tsx"
import type { StoryViewerState } from "@/features/pitch/pitch-story-utils.ts"
import {
  overlayPitchBento,
  overlayPitchLinks,
  pitchProfileFromIdentity,
} from "@/features/pitch/pitch-types.ts"
import { ApiError } from "@/lib/api-error.ts"

export function PublicPitchPage({ slug }: { slug: string }) {
  const query = useQuery({
    queryKey: pitchQueryKeys.public(slug),
    queryFn: () => getPublicPitch(slug),
    enabled: isPitchPublicSlug(slug),
    retry: false,
  })
  const [storyView, setStoryView] = useState<StoryViewerState>(null)
  const [proofView, setProofView] = useState<ProofDocument | null>(null)

  if (!isPitchPublicSlug(slug)) {
    return (
      <NotFoundPage description="This Pitch is not published, or the link is wrong." />
    )
  }

  if (query.isPending) {
    return (
      <main className="min-h-dvh bg-sidebar px-5 py-8">
        <p className="text-sm text-muted-foreground">Loading Pitch…</p>
      </main>
    )
  }

  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 404) {
      return (
        <NotFoundPage description="This Pitch is not published, or the link is wrong." />
      )
    }
    return (
      <NotFoundPage description="This Pitch could not be loaded right now." />
    )
  }

  const page = query.data
  const decoded = decodePitchContent(
    page.kind,
    page.contentVersion,
    page.content
  )
  const content = decoded.ok ? decoded.data : emptyPitchDocument()
  if (!content.published) {
    return (
      <NotFoundPage description="This Pitch is not published, or the link is wrong." />
    )
  }

  const identity = {
    name: page.author.name,
    email: page.author.email,
    image: page.author.image,
  }
  const profile = pitchProfileFromIdentity(identity, content)
  const visible = content.blocks.filter((block) => !block.hidden)
  const bento = overlayPitchBento(
    content.bento,
    identity,
    profile.github.username,
    content.storyHighlights
  )
  const links = overlayPitchLinks(
    content.links,
    identity,
    profile.github.username
  )

  return (
    <main className="min-h-dvh bg-sidebar">
      <div className="mx-auto max-w-2xl px-4 py-8 pb-16 sm:px-6">
        <PitchProfileHeader profile={profile} />

        {isGhostPitchDocument(content) ? (
          <p className="text-sm text-muted-foreground">
            This Pitch is published, but there is nothing to show yet.
          </p>
        ) : (
          <>
            <StoryHighlightsRow
              highlights={content.storyHighlights}
              onOpen={(highlightId) =>
                setStoryView({ highlightId, slideIndex: 0 })
              }
            />

            <div className="space-y-14">
              {visible.map((block) => (
                <PitchSection
                  key={block.id}
                  block={block}
                  profile={profile}
                  editing={false}
                  content={content}
                  bento={bento}
                  links={links}
                  onOpenStory={(highlightId) =>
                    setStoryView({ highlightId, slideIndex: 0 })
                  }
                  onOpenProof={setProofView}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <PitchStoryViewer
        highlights={content.storyHighlights}
        profile={profile}
        state={storyView}
        onClose={() => setStoryView(null)}
        onChange={setStoryView}
      />

      <PitchProofViewer proof={proofView} onClose={() => setProofView(null)} />
    </main>
  )
}
