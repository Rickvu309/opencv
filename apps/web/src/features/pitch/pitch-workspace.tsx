/**
 * Pitch — shareable portfolio with story highlights, bento moments, edit toolbar.
 * Do not import shell chrome — the route mounts this into `<Outlet />`.
 */
import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { Check, Copy, EyeOff, Globe, Pencil } from "lucide-react"

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
import type { StoryViewerState } from "@/features/pitch/pitch-story-utils.ts"
import {
  getPitchBento,
  getPitchFiles,
  getPitchLinks,
  getPitchProfile,
  PITCH_ACHIEVEMENTS,
  PITCH_BLOCKS,
  PITCH_EXPERIENCE,
  PITCH_GALLERY,
  PITCH_STORY_HIGHLIGHTS,
  type PitchBlock,
  type PitchBlockKind,
  type PitchProfile,
} from "@/features/pitch/pitch-types.ts"

export function PitchWorkspace() {
  const [mode, setMode] = useState<"preview" | "edit">("preview")
  const [blocks, setBlocks] = useState(PITCH_BLOCKS)
  const [profile, setProfile] = useState(getPitchProfile)
  const [copied, setCopied] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [storyView, setStoryView] = useState<StoryViewerState>(null)

  const editing = mode === "edit"
  const visible = blocks.filter((b) => !b.hidden)
  const bento = getPitchBento(profile)
  const files = getPitchFiles(profile)
  const links = getPitchLinks(profile)

  function hideBlock(id: string) {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, hidden: true } : b))
    )
  }

  function addBlock(kind: PitchBlockKind) {
    const exists = blocks.some((b) => b.kind === kind && !b.hidden)
    if (exists) {
      setBlocks((prev) =>
        prev.map((b) => (b.kind === kind ? { ...b, hidden: false } : b))
      )
    } else {
      setBlocks((prev) => [...prev, { id: `b-${kind}-${Date.now()}`, kind }])
    }
    setAddOpen(false)
  }

  function openStory(highlightId: string) {
    setStoryView({ highlightId, slideIndex: 0 })
  }

  function publish() {
    setProfile((p) => ({ ...p, published: true }))
  }

  function unpublish() {
    setProfile((p) => ({ ...p, published: false }))
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
    <div className="relative flex h-full min-h-0 flex-col bg-[#FAFAFA]">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-background px-4 py-2.5 sm:px-5">
        <Globe className="size-4 text-muted-foreground" />
        <span className="text-sm font-semibold tracking-tight">Pitch</span>

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

        <div className="ml-auto flex items-center gap-2">
          {profile.published ? (
            <span className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-800 sm:inline-flex">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Published
            </span>
          ) : (
            <span className="hidden items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-900 sm:inline-flex">
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
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        <div
          className={cn(
            "mx-auto max-w-2xl px-4 py-8 sm:px-6",
            editing ? "pb-28" : "pb-16"
          )}
        >
          {!profile.published ? (
            <div className="mb-6 flex items-center gap-2 rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
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
            onStatusChange={(status) => setProfile((p) => ({ ...p, status }))}
          />

          <StoryHighlightsRow
            highlights={PITCH_STORY_HIGHLIGHTS}
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
                bento={bento}
                files={files}
                links={links}
                onHide={() => hideBlock(block.id)}
                onAboutChange={(about) => setProfile((p) => ({ ...p, about }))}
                onOpenStory={openStory}
              />
            ))}
          </div>
        </div>
      </div>

      {editing ? (
        <PitchEditToolbar
          published={profile.published}
          addOpen={addOpen}
          onToggleAdd={() => setAddOpen((o) => !o)}
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
        highlights={PITCH_STORY_HIGHLIGHTS}
        profile={profile}
        state={storyView}
        onClose={() => setStoryView(null)}
        onChange={setStoryView}
      />
    </div>
  )
}

function PitchSection({
  block,
  profile,
  editing,
  bento,
  files,
  links,
  onHide,
  onAboutChange,
  onOpenStory,
}: {
  block: PitchBlock
  profile: PitchProfile
  editing: boolean
  bento: ReturnType<typeof getPitchBento>
  files: ReturnType<typeof getPitchFiles>
  links: ReturnType<typeof getPitchLinks>
  onHide: () => void
  onAboutChange: (text: string) => void
  onOpenStory: (highlightId: string) => void
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
          items={PITCH_ACHIEVEMENTS}
          editing={editing}
          onHide={onHide}
        />
      )
    case "experience":
      return (
        <ExperienceSection
          items={PITCH_EXPERIENCE}
          editing={editing}
          onHide={onHide}
        />
      )
    case "work":
      return <WorkSection files={files} editing={editing} onHide={onHide} />
    case "github":
      return (
        <GithubSection profile={profile} editing={editing} onHide={onHide} />
      )
    case "contact":
      return <ContactSection links={links} editing={editing} onHide={onHide} />
    case "gallery":
      return (
        <GallerySection
          items={PITCH_GALLERY}
          editing={editing}
          onHide={onHide}
        />
      )
    default:
      return null
  }
}
