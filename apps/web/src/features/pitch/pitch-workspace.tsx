/**
 * Pitch — shareable portfolio with story highlights, bento moments, edit toolbar.
 * Do not import shell chrome — the route mounts this into `<Outlet />`.
 */
import { useState } from "react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty-state"
import { cn } from "@workspace/ui/lib/utils"
import {
  emptyPitchDocument,
  isDemoPitchDocument,
  isGhostPitchDocument,
  type PitchBlockKind,
  type PitchDocument,
  type ProofDocument,
} from "@workspace/domain"
import { Check, Copy, EyeOff, Globe, Pencil } from "lucide-react"

import { ErrorBanner } from "@/components/error-banner.tsx"
import { WorkspaceHeader } from "@/components/workspace-header.tsx"
import { PitchEditToolbar } from "@/features/pitch/pitch-edit-toolbar.tsx"
import {
  AboutSection,
  AchievementsSection,
  ContactSection,
  ExperienceSection,
  GallerySection,
  GithubSection,
  PitchProfileHeader,
  WorkSection,
} from "@/features/pitch/pitch-showcase.tsx"
import {
  MomentsBentoSection,
  PitchStoryViewer,
  StoryHighlightsRow,
} from "@/features/pitch/pitch-stories.tsx"
import { PitchProofViewer } from "@/features/pitch/pitch-proof-viewer.tsx"
import type { StoryViewerState } from "@/features/pitch/pitch-story-utils.ts"
import {
  overlayPitchBento,
  overlayPitchLinks,
  pitchProfileFromIdentity,
  type PitchBlock,
  type PitchIdentity,
  type PitchProfile,
} from "@/features/pitch/pitch-types.ts"
import { recordFirstCafeWin } from "@/features/home/first-cafe-checklist.ts"
import { usePitch } from "@/features/pitch/use-pitch.ts"
import { authClient } from "@/lib/auth-client.ts"

export function PitchWorkspace() {
  const { data: session } = authClient.useSession()
  const pitch = usePitch()
  const [mode, setMode] = useState<"preview" | "edit">("preview")
  const [copied, setCopied] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [storyView, setStoryView] = useState<StoryViewerState>(null)
  const [proofView, setProofView] = useState<ProofDocument | null>(null)

  const identity: PitchIdentity = {
    name: session?.user.name?.trim() || "You",
    email: session?.user.email ?? "",
    image: session?.user.image,
  }
  const content = pitch.content
  const profile = pitchProfileFromIdentity(identity, content)
  const editing = mode === "edit"
  const visible = content.blocks.filter((b) => !b.hidden)
  const bento = overlayPitchBento(
    content.bento,
    identity,
    profile.github.username,
    content.storyHighlights
  )
  const links = overlayPitchLinks(content.links, identity, profile.github.username)

  function hideBlock(id: string) {
    pitch.persist((current) => ({
      ...current,
      blocks: current.blocks.map((b) =>
        b.id === id ? { ...b, hidden: true } : b
      ),
    }))
  }

  function addBlock(kind: PitchBlockKind) {
    pitch.persist((current) => {
      const exists = current.blocks.some((b) => b.kind === kind && !b.hidden)
      if (exists) {
        return {
          ...current,
          blocks: current.blocks.map((b) =>
            b.kind === kind ? { ...b, hidden: false } : b
          ),
        }
      }
      return {
        ...current,
        blocks: [...current.blocks, { id: `b-${kind}-${Date.now()}`, kind }],
      }
    })
    setAddOpen(false)
  }

  function openStory(highlightId: string) {
    setStoryView({ highlightId, slideIndex: 0 })
  }

  function publish() {
    pitch.persist((current) => ({ ...current, published: true }))
  }

  function unpublish() {
    pitch.persist((current) => ({ ...current, published: false }))
  }

  function clearDemo() {
    const userId = session?.user.id
    if (userId) recordFirstCafeWin(userId, "pitch")
    pitch.persist(() => emptyPitchDocument())
    setMode("preview")
  }

  async function copyLink() {
    if (!profile.published) return
    try {
      await navigator.clipboard.writeText(`https://${profile.slug}`)
    } catch {
      return
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-sidebar">
      <WorkspaceHeader
        title="Pitch"
        icon={<Globe className="size-4 text-muted-foreground" />}
      >

        {!editing ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="ml-2 h-8"
            onClick={() => setMode("edit")}
          >
            <Pencil className="size-3.5" />
            Edit profile
          </Button>
        ) : null}

        {isDemoPitchDocument(content) ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8"
            onClick={clearDemo}
          >
            Clear demo
          </Button>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          {profile.published ? (
            <span className="hidden items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-micro font-medium text-success sm:inline-flex">
              <span className="size-1.5 rounded-full bg-success" />
              Published
            </span>
          ) : (
            <span className="hidden items-center gap-1.5 rounded-full bg-warning/15 px-2.5 py-1 text-micro font-medium text-warning-foreground sm:inline-flex">
              <EyeOff className="size-3" />
              Draft
            </span>
          )}

          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8"
            disabled={!profile.published}
            onClick={copyLink}
          >
            {copied ? (
              <>
                <Check className="size-3.5" />
                Copied
              </>
            ) : (
              <>
                <Copy className="size-3.5" />
                Copy link
              </>
            )}
          </Button>
        </div>
      </WorkspaceHeader>

      {pitch.error ? <ErrorBanner>{pitch.error}</ErrorBanner> : null}

      {isDemoPitchDocument(content) ? (
        <div
          role="status"
          className="flex shrink-0 flex-col gap-3 border-b border-border bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:px-5"
        >
          <div className="min-w-0 flex-1">
            <Badge variant="secondary">Demo content</Badge>
            <p className="mt-1.5 text-sm text-muted-foreground">
              This page is a sample, not your story.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 shrink-0"
            onClick={clearDemo}
          >
            Clear demo
          </Button>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto">
        {pitch.isLoading ? (
          <p className="px-5 py-8 text-sm text-muted-foreground">Loading Pitch…</p>
        ) : (
        <div
          className={cn(
            "mx-auto max-w-2xl px-4 py-8 sm:px-6",
            editing ? "pb-28" : "pb-16"
          )}
        >
          {!profile.published ? (
            <div className="mb-6 flex items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
              <EyeOff className="size-4 shrink-0 opacity-70" />
              <span>
                This page is <strong>unpublished</strong> — only you can see it.
                Hit Publish when you&apos;re ready to share.
              </span>
            </div>
          ) : null}

          <PitchProfileHeader
            profile={profile}
            editing={editing}
            onStatusChange={(status) =>
              pitch.persist((current) => ({ ...current, status }))
            }
          />

          {isGhostPitchDocument(content) && !editing ? (
            <Empty className="mt-2 border border-dashed border-border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Globe className="size-4" />
                </EmptyMedia>
                <EmptyTitle>Your Pitch is empty</EmptyTitle>
                <EmptyDescription>
                  Write a line about what you want next, or leave it quiet until
                  you have something to show.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setMode("edit")}
                >
                  <Pencil className="size-3.5" />
                  Start your Pitch
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <>
              <StoryHighlightsRow
                highlights={content.storyHighlights}
                editing={editing}
                onOpen={openStory}
              />

              <div className="space-y-14">
                {visible.map((block) => (
                  <PitchSection
                    key={block.id}
                    block={block}
                    profile={profile}
                    editing={editing}
                    content={content}
                    bento={bento}
                    links={links}
                    onHide={() => hideBlock(block.id)}
                    onAboutChange={(about) =>
                      pitch.persist((current) => ({ ...current, about }))
                    }
                    onOpenStory={openStory}
                    onOpenProof={setProofView}
                  />
                ))}
              </div>
            </>
          )}
        </div>
        )}
      </div>

      {editing ? (
        <PitchEditToolbar
          published={profile.published}
          addOpen={addOpen}
          onAddOpenChange={setAddOpen}
          onAddBlock={addBlock}
          onPublish={publish}
          onUnpublish={unpublish}
          onDone={() => {
            setAddOpen(false)
            setMode("preview")
          }}
        />
      ) : null}

      <PitchStoryViewer
        highlights={content.storyHighlights}
        profile={profile}
        state={storyView}
        onClose={() => setStoryView(null)}
        onChange={setStoryView}
      />

      <PitchProofViewer
        proof={proofView}
        onClose={() => setProofView(null)}
      />
    </div>
  )
}

function PitchSection({
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
}: {
  block: PitchBlock
  profile: PitchProfile
  editing: boolean
  content: PitchDocument
  bento: ReturnType<typeof overlayPitchBento>
  links: ReturnType<typeof overlayPitchLinks>
  onHide: () => void
  onAboutChange: (text: string) => void
  onOpenStory: (highlightId: string) => void
  onOpenProof: (proof: ProofDocument) => void
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
