/**
 * Read.cv-inspired vertical showcase — timeline sections for achievements.
 */
import type { ReactNode } from "react"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"
import {
  Code2,
  File,
  FileSpreadsheet,
  FileText,
  ImagePlus,
  Link2,
  Mail,
  PenTool,
  Share2,
} from "lucide-react"

import {
  pitchHasCheckoutAchievement,
  type ProofDocument,
} from "@workspace/domain"

import { ComingSoon } from "@/components/coming-soon.tsx"
import { profileInitials } from "@/features/app-shell/profile-display.ts"
import { PitchGithubHeatmap } from "@/features/pitch/pitch-github-graph.tsx"
import { resolveAchievementProof } from "@/features/pitch/pitch-proof.ts"
import {
  getMockGithubProfile,
  MOCK_GITHUB_CONTRIBUTIONS,
} from "@/features/pitch/pitch-github-mock.ts"
import {
  paperDocPitchMeta,
  pitchToneClass,
  type PitchAchievement,
  type PitchExperience,
  type PitchFile,
  type PitchGalleryItem,
  type PitchLink,
  type PitchProfile,
  type PitchWorkDoc,
} from "@/features/pitch/pitch-types.ts"

function SectionShell({
  title,
  editing,
  onHide,
  children,
}: {
  title: string
  editing?: boolean
  onHide?: () => void
  children: ReactNode
}) {
  return (
    <section className="group relative">
      {editing ? (
        <div className="absolute -top-1 right-0 flex gap-1">
          <span className="rounded-md border border-border bg-background px-1.5 py-0.5 text-xs text-muted-foreground shadow-sm">
            {title}
          </span>
          {onHide ? (
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={onHide}
              className="h-auto px-1.5 py-0.5 text-xs"
            >
              Hide
            </Button>
          ) : null}
        </div>
      ) : null}
      <h2 className="mb-5 text-xs font-medium tracking-widest text-muted-foreground uppercase">
        {title}
      </h2>
      {children}
    </section>
  )
}

function TimelineRow({
  when,
  children,
}: {
  when: string
  children: ReactNode
}) {
  return (
    <div className="grid grid-cols-[3.25rem_1fr] gap-x-4 gap-y-1 sm:grid-cols-[4.5rem_1fr]">
      <p className="pt-0.5 text-sm text-muted-foreground tabular-nums">
        {when}
      </p>
      <div>{children}</div>
    </div>
  )
}

function PitchAvatar({
  src,
  name,
  className,
}: {
  src: string
  name: string
  className?: string
}) {
  return (
    <Avatar className={cn("size-16 sm:size-[4.5rem]", className)}>
      {src ? <AvatarImage src={src} alt="" /> : null}
      <AvatarFallback className="text-lg font-medium text-foreground">
        {profileInitials(name)}
      </AvatarFallback>
    </Avatar>
  )
}

export function PitchProfileHeader({
  profile,
  editing,
  nameAs: Name = "h1",
  onStatusChange,
}: {
  profile: PitchProfile
  editing?: boolean
  nameAs?: "h1" | "h2"
  onStatusChange?: (status: string) => void
}) {
  return (
    <header className="mb-10">
      <div className="flex items-start gap-4">
        <PitchAvatar src={profile.avatar} name={profile.name} />
        <div className="min-w-0 pt-0.5">
          <Name className="text-3xl font-semibold tracking-tight">
            {profile.name}
          </Name>
          <p className="mt-1 text-sm text-muted-foreground">
            {profile.headline}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {profile.location}
          </p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {profile.slug}
          </p>
        </div>
      </div>

      {editing || profile.status.trim() ? (
        <div className="mt-5 rounded-xl border border-border/80 bg-muted/25 px-4 py-3">
          {editing ? (
            <Input
              value={profile.status}
              onChange={(e) => onStatusChange?.(e.target.value)}
              className="h-auto w-full border-0 bg-transparent px-0 py-0 shadow-none focus-visible:border-0 focus-visible:ring-0"
              placeholder="Status — what you're open to"
            />
          ) : (
            <p className="flex items-start gap-2 text-sm leading-relaxed">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
              {profile.status}
            </p>
          )}
        </div>
      ) : null}
    </header>
  )
}

export function AboutSection({
  text,
  editing,
  onHide,
  onChange,
}: {
  text: string
  editing?: boolean
  onHide?: () => void
  onChange?: (text: string) => void
}) {
  return (
    <SectionShell title="About" editing={editing} onHide={onHide}>
      {editing ? (
        <Textarea
          value={text}
          onChange={(e) => onChange?.(e.target.value)}
          rows={6}
          className="min-h-0 resize-none rounded-xl text-sm leading-relaxed"
        />
      ) : (
        <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          {text.split("\n\n").map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      )}
    </SectionShell>
  )
}

export function AchievementsSection({
  items,
  editing,
  onHide,
  onOpenProof,
  onAdd,
}: {
  items: PitchAchievement[]
  editing?: boolean
  onHide?: () => void
  onOpenProof?: (proof: ProofDocument) => void
  onAdd?: () => void
}) {
  const proofMeta = paperDocPitchMeta({ type: "proof" })
  const canAddProof = Boolean(onAdd) && !pitchHasCheckoutAchievement(items)

  return (
    <SectionShell title="Achievements" editing={editing} onHide={onHide}>
      {items.length === 0 && editing ? (
        <p className="text-sm leading-relaxed text-muted-foreground">
          Add a Proof you can open — a checkout hallway study is ready.
        </p>
      ) : null}
      <ul className="space-y-10">
        {items.map((item) => {
          const proof = onOpenProof ? resolveAchievementProof(item) : null
          return (
            <li key={item.id}>
              <TimelineRow when={item.year}>
                <div>
                  <p className="leading-snug font-medium">
                    {item.title}
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      · {item.context}
                    </span>
                  </p>
                  {item.tag ? (
                    <span className="mt-1.5 inline-block rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                      {item.tag}
                    </span>
                  ) : null}
                  <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                  {proof && onOpenProof ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onOpenProof(proof)}
                      aria-label={`Open Proof: ${proof.title}`}
                      className="mt-3 h-auto w-full justify-start gap-3 rounded-xl p-3 text-left font-normal whitespace-normal"
                    >
                      <span
                        className={cn(
                          "flex size-10 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                          proofMeta.gradient
                        )}
                      >
                        {proofMeta.badge}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">
                          Open Proof
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          Proof chain
                        </span>
                      </span>
                    </Button>
                  ) : null}
                </div>
              </TimelineRow>
            </li>
          )
        })}
      </ul>
      {editing ? (
        <Button
          type="button"
          disabled={!canAddProof}
          variant="ghost"
          className="mt-6 h-auto px-0 text-xs font-medium text-muted-foreground"
          onClick={canAddProof ? onAdd : undefined}
        >
          + Add achievement
          {canAddProof ? null : <ComingSoon />}
        </Button>
      ) : null}
    </SectionShell>
  )
}

export function ExperienceSection({
  items,
  editing,
  onHide,
}: {
  items: PitchExperience[]
  editing?: boolean
  onHide?: () => void
}) {
  return (
    <SectionShell title="Experience" editing={editing} onHide={onHide}>
      <ul className="space-y-8">
        {items.map((item) => (
          <li key={item.id}>
            <TimelineRow when={item.period}>
              <div>
                <p className="leading-snug font-medium">
                  {item.title}
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    at {item.org}
                  </span>
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.summary}
                </p>
              </div>
            </TimelineRow>
          </li>
        ))}
      </ul>
    </SectionShell>
  )
}

export function WorkSection({
  files,
  workDocs,
  editing,
  onHide,
}: {
  files: PitchFile[]
  workDocs: PitchWorkDoc[]
  editing?: boolean
  onHide?: () => void
}) {
  const docs = workDocs.filter((d) => d.type !== "letter").slice(0, 3)

  return (
    <SectionShell title="Work & documents" editing={editing} onHide={onHide}>
      <div className="space-y-3">
        {docs.map((doc) => {
          const meta = paperDocPitchMeta(doc)
          return (
            <div
              key={doc.id}
              className="flex w-full items-center gap-3 rounded-xl border border-border/70 bg-muted/15 p-3 text-left"
            >
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                  meta.gradient
                )}
              >
                {meta.badge}
              </div>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {doc.name}
                </span>
                <span className="block text-xs font-normal text-muted-foreground">
                  {doc.updated} · {doc.status}
                </span>
              </span>
            </div>
          )
        })}
      </div>

      <ul className="mt-4 flex flex-wrap gap-2 border-t border-border/60 pt-4">
        {files.map((file) => (
          <li key={file.id}>
            <div className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-background px-3 py-2 text-left text-xs">
              <FileKindIcon kind={file.kind} />
              <span>
                <span className="block font-medium">{file.name}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {file.meta}
                </span>
              </span>
            </div>
          </li>
        ))}
      </ul>
    </SectionShell>
  )
}

function FileKindIcon({ kind }: { kind: PitchFile["kind"] }) {
  const cls = "size-3.5 shrink-0 text-muted-foreground"
  switch (kind) {
    case "pdf":
      return <FileText className={cls} />
    case "fig":
      return <PenTool className={cls} />
    case "sheet":
      return <FileSpreadsheet className={cls} />
    default:
      return <File className={cls} />
  }
}

export function GithubSection({
  profile,
  editing,
  onHide,
}: {
  profile: PitchProfile
  editing?: boolean
  onHide?: () => void
}) {
  const mock = getMockGithubProfile(profile.name, profile.avatar)

  return (
    <SectionShell title="GitHub" editing={editing} onHide={onHide}>
      <div className="min-w-0 overflow-hidden rounded-xl border border-border/70 bg-muted/15 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <PitchAvatar
              src={profile.avatar}
              name={profile.name}
              className="size-8 sm:size-8"
            />
            <div className="min-w-0">
              <p className="block truncate font-mono text-sm font-medium">
                @{mock.username}
              </p>
              <span className="inline-flex items-center gap-1 text-xs text-foreground">
                <span className="size-1.5 rounded-full bg-primary" />
                Connected · mock integration
              </span>
            </div>
          </div>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground tabular-nums">
            {mock.totalLastYear}
          </span>{" "}
          contributions in the last year on GitHub
        </p>

        <PitchGithubHeatmap
          contributions={MOCK_GITHUB_CONTRIBUTIONS}
          total={mock.totalLastYear}
          className="mt-3"
        />

        <dl className="mt-4 grid grid-cols-4 gap-2 border-t border-border/50 pt-3 text-center">
          <div>
            <dt className="text-xs text-muted-foreground uppercase">Streak</dt>
            <dd className="text-sm font-semibold tabular-nums">
              {mock.streak}d
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground uppercase">Repos</dt>
            <dd className="text-sm font-semibold tabular-nums">
              {mock.publicRepos}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground uppercase">Since</dt>
            <dd className="text-sm font-semibold tabular-nums">
              {mock.memberSince}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground uppercase">Top</dt>
            <dd className="truncate text-sm font-semibold">
              {mock.topLanguage}
            </dd>
          </div>
        </dl>
      </div>
      {editing ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Live GitHub data waits on a product decision. This heatmap is mock
          data for @{mock.username}.
        </p>
      ) : null}
    </SectionShell>
  )
}

export function ContactSection({
  links,
  editing,
  onHide,
}: {
  links: PitchLink[]
  editing?: boolean
  onHide?: () => void
}) {
  const email = links.find((l) => l.icon === "mail")

  return (
    <SectionShell title="Contact" editing={editing} onHide={onHide}>
      {email ? (
        <div className="mb-4 flex flex-col rounded-xl border border-border bg-muted/20 px-4 py-3">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Email
          </span>
          <span className="mt-1 text-base font-semibold">
            {email.href.replace("mailto:", "")}
          </span>
        </div>
      ) : null}
      <ul className="space-y-1">
        {links
          .filter((l) => l.icon !== "mail")
          .map((link) => (
            <li key={link.id}>
              <div className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm">
                <LinkIcon kind={link.icon} />
                <span className="font-medium">{link.label}</span>
              </div>
            </li>
          ))}
      </ul>
    </SectionShell>
  )
}

export function GallerySection({
  items,
  editing,
  onHide,
}: {
  items: PitchGalleryItem[]
  editing?: boolean
  onHide?: () => void
}) {
  return (
    <SectionShell title="Gallery" editing={editing} onHide={onHide}>
      <div className="grid grid-cols-3 gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "flex aspect-[4/3] items-end rounded-xl p-2 outline outline-1 outline-black/[0.04]",
              pitchToneClass(item.tone)
            )}
          >
            <span className="text-xs font-medium opacity-80">
              {item.caption}
            </span>
          </div>
        ))}
        {editing ? (
          <Button
            type="button"
            disabled
            variant="ghost"
            className="flex aspect-[4/3] h-auto flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-muted-foreground"
          >
            <ImagePlus className="size-4" />
            <span className="text-xs">Upload</span>
            <ComingSoon />
          </Button>
        ) : null}
      </div>
    </SectionShell>
  )
}

function LinkIcon({ kind }: { kind: PitchLink["icon"] }) {
  const cls = "size-4 text-muted-foreground"
  switch (kind) {
    case "github":
      return <Code2 className={cls} />
    case "linkedin":
      return <Share2 className={cls} />
    case "mail":
      return <Mail className={cls} />
    default:
      return <Link2 className={cls} />
  }
}

export { PitchAvatar }
