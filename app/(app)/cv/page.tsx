"use client";

// CV, where a CV gets built rather than uploaded.
//
// Two panes: what you are writing on the left, what a recruiter opens on the
// right. The preview is the real document (components/cv/resume-document.tsx),
// scaled down, not an impression of it, so "looks right here" and "prints
// right" are the same claim.
//
// Every edit dispatches through lib/actions, which is what lets the Coach build
// and rewrite a CV through the same fourteen `resume.*` actions this screen
// uses. Ask it to sharpen a bullet and you watch the row flash on this page.

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  FileDown,
  FilePlus2,
  Plus,
  Printer,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { CoachCat } from "@/components/brand/coach-cat";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DraftInput } from "@/components/cv/draft-field";
import { ResumePreview, ResumePrintPortal } from "@/components/cv/resume-preview";
import { SectionEditor } from "@/components/cv/section-editor";
import { useAppState, useDispatch } from "@/lib/actions/store";
import {
  download,
  fileStem,
  toJson,
  toMarkdown,
  toPlainText,
} from "@/lib/cv/export";
import {
  resumeCompleteness,
  sectionDefaults,
  sectionOrder,
  type Resume,
  templateHasPhoto,
  templates,
  type ResumeSectionKind,
} from "@/lib/cv/types";
import { PhotoField } from "@/components/cv/photo-field";
import { localeNames, locales } from "@/lib/i18n/locale";
import { useT } from "@/lib/i18n/use-t";

export default function CvPage() {
  const { resumes, profile } = useAppState();
  const dispatch = useDispatch();
  const { t, m } = useT();
  const [activeId, setActiveId] = React.useState<string | null>(null);

  // The active CV, or the newest one. Held as an id rather than an object so a
  // dispatch that rewrites the list does not leave this pointing at a stale copy.
  const active =
    resumes.find((r) => r.id === activeId) ?? resumes.at(-1) ?? null;

  // The reducer mints the id, so a newly created CV is found by watching the
  // list rather than by re-deriving the id here; same shape as Todo and the
  // career map.
  const selectNewest = React.useRef(false);
  React.useEffect(() => {
    const newest = resumes.at(-1);
    if (selectNewest.current && newest) {
      setActiveId(newest.id);
      selectNewest.current = false;
    }
  }, [resumes]);

  const create = (fromProfile: boolean) => {
    const role = profile.identity.targetRole.trim();
    selectNewest.current = true;
    dispatch(
      "resume.create",
      {
        label: role
          ? t(m.cv.forRole(role))
          : t(m.cv.untitled(resumes.length + 1)),
        ...(role ? { targetRole: role } : {}),
        fromProfile,
      },
      { silent: true },
    );
  };

  if (!active) return <EmptyState onCreate={create} hasProfile={Boolean(profile.identity.name)} />;

  return (
    <div className="flex h-full flex-col">
      <Toolbar
        resume={active}
        resumes={resumes}
        onSelect={setActiveId}
        onCreate={create}
      />

      <div className="flex min-h-0 flex-1">
        {/* ── Editor ─────────────────────────────────────── */}
        <div className="min-h-0 w-full shrink-0 overflow-y-auto border-r lg:w-[26rem] xl:w-[30rem]">
          <HeaderEditor resume={active} />

          <div className="space-y-3 px-4 pb-6">
            {active.sections.map((section, i) => (
              <SectionEditor
                key={section.id}
                resumeId={active.id}
                section={section}
                isFirst={i === 0}
                isLast={i === active.sections.length - 1}
              />
            ))}

            <AddSectionMenu resume={active} />
          </div>
        </div>

        {/* ── Preview ────────────────────────────────────── */}
        <div className="hidden min-w-0 flex-1 overflow-y-auto bg-muted/40 p-6 lg:block">
          <div className="mx-auto max-w-[794px]">
            <ResumePreview resume={active} />
          </div>
        </div>
      </div>

      {/* Off-screen until the print stylesheet asks for it; see globals.css. */}
      <ResumePrintPortal resume={active} />
    </div>
  );
}

/* ── Empty state ─────────────────────────────────────────── */

function EmptyState({
  onCreate,
  hasProfile,
}: {
  onCreate: (fromProfile: boolean) => void;
  hasProfile: boolean;
}) {
  const { t, m } = useT();
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <span
        aria-hidden
        className="flex size-12 items-center justify-center rounded-xl border bg-card"
      >
        <CoachCat size="lg" className="text-foreground" />
      </span>
      <h2 className="mt-5 text-lg font-semibold tracking-tight">
        {t(m.cv.emptyTitle)}
      </h2>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground text-pretty">
        {t(hasProfile ? m.cv.emptyWithProfile : m.cv.emptyWithoutProfile)}
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Button onClick={() => onCreate(true)}>
          <Sparkles className="size-4" />
          {t(m.cv.buildFromProfile)}
        </Button>
        <Button variant="outline" onClick={() => onCreate(false)}>
          <Plus className="size-4" />
          {t(m.cv.startBlank)}
        </Button>
      </div>

      {!hasProfile && (
        <Button asChild variant="ghost" size="sm" className="mt-3">
          <Link href="/profile">
            <ArrowLeft className="size-4" />
            {t(m.cv.fillProfileFirst)}
          </Link>
        </Button>
      )}
    </div>
  );
}

/* ── Toolbar ─────────────────────────────────────────────── */

function Toolbar({
  resume,
  resumes,
  onSelect,
  onCreate,
}: {
  resume: Resume;
  resumes: Resume[];
  onSelect: (id: string) => void;
  onCreate: (fromProfile: boolean) => void;
}) {
  const dispatch = useDispatch();
  const { t, m } = useT();
  const complete = resumeCompleteness(resume);

  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
      <DropdownMenu>
        <DropdownMenuTrigger className="flex h-7 min-w-0 items-center gap-1.5 rounded-md px-2 text-sm font-medium transition-colors outline-none hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none">
          <span className="truncate">{resume.label}</span>
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {resumes.length > 1 ? t(m.profile.versionCount(resumes.length)) : ""}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="text-muted-foreground">
            {t(m.cv.yourCvs)}
          </DropdownMenuLabel>
          {resumes.map((r) => (
            <DropdownMenuItem key={r.id} onSelect={() => onSelect(r.id)}>
              <span className="min-w-0 flex-1 truncate">{r.label}</span>
              {r.id === resume.id && <Check className="size-3.5" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => onCreate(true)}>
            <Sparkles />
            {t(m.cv.buildFromProfile)}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onCreate(false)}>
            <Plus />
            {t(m.cv.blankCv)}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              dispatch("resume.duplicate", {
                id: resume.id,
                label: t(m.cv.copySuffix(resume.label)),
              })
            }
          >
            <Copy />
            {t(m.cv.duplicate)}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => dispatch("resume.remove", { id: resume.id })}
          >
            <Trash2 />
            {t(m.cv.deleteCv)}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Tooltip>
        <TooltipTrigger asChild>
          <span className="hidden shrink-0 items-center gap-1.5 text-xs text-muted-foreground sm:flex">
            <span className="h-1 w-16 overflow-hidden rounded-full bg-muted">
              <span
                className="block h-full rounded-full bg-foreground animate-bar-grow motion-reduce:animate-none"
                style={{ width: `${complete}%` }}
              />
            </span>
            <span className="tabular-nums">{complete}%</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {t(m.cv.completeness)}
        </TooltipContent>
      </Tooltip>

      <div className="ml-auto flex items-center gap-1">
        <ThemeMenu resume={resume} />
        <ExportMenu resume={resume} />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" onClick={() => window.print()}>
              <Printer className="size-3.5" />
              <span className="hidden sm:inline">{t(m.cv.exportPdf)}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {t(m.cv.exportPdfHint)}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

// One list, in lib/cv/types.ts, so the picker and the model cannot drift.
const templateKeys = templates;
const accentKeys = ["ink", "blue", "green", "plum"] as const;
const densityKeys = ["airy", "normal", "tight"] as const;

function ThemeMenu({ resume }: { resume: Resume }) {
  const dispatch = useDispatch();
  const { t, m } = useT();
  const templateLabels = {
    classic: t(m.cv.templateClassic),
    modern: t(m.cv.templateModern),
    compact: t(m.cv.templateCompact),
  };
  const accentLabels = {
    ink: t(m.cv.accentInk),
    blue: t(m.cv.accentBlue),
    green: t(m.cv.accentGreen),
    plum: t(m.cv.accentPlum),
  };
  const densityLabels = {
    airy: t(m.cv.densityAiry),
    normal: t(m.cv.densityNormal),
    tight: t(m.cv.densityTight),
  };
  const set = (fields: Record<string, string>) =>
    dispatch("resume.setTheme", { id: resume.id, ...fields }, { silent: true });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          {t(m.cv.appearance)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-muted-foreground">
          {t(m.cv.template)}
        </DropdownMenuLabel>
        {templateKeys.map(
          (key) => (
            <DropdownMenuItem key={key} onSelect={() => set({ template: key })}>
              <span className="flex-1">{templateLabels[key]}</span>
              {resume.theme.template === key && <Check className="size-3.5" />}
            </DropdownMenuItem>
          ),
        )}

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-muted-foreground">
          {t(m.cv.accent)}
        </DropdownMenuLabel>
        {accentKeys.map(
          (key) => (
            <DropdownMenuItem key={key} onSelect={() => set({ accent: key })}>
              <span className="flex-1">{accentLabels[key]}</span>
              {resume.theme.accent === key && <Check className="size-3.5" />}
            </DropdownMenuItem>
          ),
        )}

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-muted-foreground">
          {t(m.cv.density)} · {t(m.cv.densityHint)}
        </DropdownMenuLabel>
        {densityKeys.map(
          (key) => (
            <DropdownMenuItem key={key} onSelect={() => set({ density: key })}>
              <span className="flex-1">{densityLabels[key]}</span>
              {resume.theme.density === key && <Check className="size-3.5" />}
            </DropdownMenuItem>
          ),
        )}

        <DropdownMenuSeparator />
        {/* The document's language, separate from the app's on purpose:
            applying abroad means an English CV, and needing to switch the whole
            interface to write one would be the wrong trade. Only the default
            headings of sections added from here on follow it; headings already
            written are the user's words and are left alone. */}
        <DropdownMenuLabel className="text-muted-foreground">
          {t(m.cv.cvLanguage)}
        </DropdownMenuLabel>
        {locales.map((code) => (
          <DropdownMenuItem
            key={code}
            onSelect={() =>
              dispatch(
                "resume.rename",
                { id: resume.id, language: code },
                { silent: true },
              )
            }
          >
            <span className="flex-1">{localeNames[code]}</span>
            {resume.language === code && <Check className="size-3.5" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ExportMenu({ resume }: { resume: Resume }) {
  const { t, m } = useT();
  const stem = fileStem(resume);

  const save = (extension: string, contents: string, mime: string) => {
    download(`${stem}.${extension}`, contents, mime);
    toast.success(t(m.cv.downloaded(`${stem}.${extension}`)));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <FileDown className="size-3.5" />
          <span className="hidden sm:inline">{t(m.cv.exportLabel)}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-muted-foreground">
          {t(m.cv.exportDownload)}
        </DropdownMenuLabel>
        <DropdownMenuItem
          onSelect={() => save("md", toMarkdown(resume), "text/markdown")}
        >
          <Download />
          <span className="flex-1">{t(m.cv.exportMarkdown)}</span>
          <span className="text-xs text-muted-foreground">.md</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => save("txt", toPlainText(resume), "text/plain")}
        >
          <Download />
          <span className="flex-1">{t(m.cv.exportText)}</span>
          <span className="text-xs text-muted-foreground">.txt</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => save("json", toJson(resume), "application/json")}
        >
          <Download />
          <span className="flex-1">{t(m.cv.exportJson)}</span>
          <span className="text-xs text-muted-foreground">.json</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            void navigator.clipboard
              .writeText(toPlainText(resume))
              .then(() => toast.success(t(m.cv.copied)))
              .catch(() =>
                toast.error(t(m.cv.copyFailedTitle), {
                  description: t(m.cv.copyFailedBody),
                }),
              );
          }}
        >
          <Copy />
          {t(m.cv.exportCopy)}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ── Header editor ───────────────────────────────────────── */

function HeaderEditor({ resume }: { resume: Resume }) {
  const dispatch = useDispatch();
  const { t, m } = useT();
  const { header } = resume;

  const set = (fields: Record<string, unknown>) =>
    dispatch("resume.setHeader", { id: resume.id, ...fields }, { silent: true });

  return (
    <div className="space-y-4 border-b p-4">
      {/* Only where the chosen template has somewhere to put it. Offering an
          upload for a template that will not print it is offering the user a
          decision the document then ignores. AC-PAPERS-010.4. */}
      {templateHasPhoto(resume.theme.template) && <PhotoField resume={resume} />}

      <DraftInput
        id="cv-label"
        label={t(m.cv.cvName)}
        value={resume.label}
        placeholder={t(m.cv.cvNamePlaceholder)}
        onCommit={(label) =>
          label && dispatch("resume.rename", { id: resume.id, label }, { silent: true })
        }
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <DraftInput
          id="cv-name"
          label={t(m.cv.headerName)}
          value={header.name}
          onCommit={(name) => set({ name })}
        />
        <DraftInput
          id="cv-headline"
          label={t(m.cv.headerHeadline)}
          value={header.headline}
          placeholder={t(m.cv.headerHeadlinePlaceholder)}
          onCommit={(headline) => set({ headline })}
        />
        <DraftInput
          id="cv-email"
          label={t(m.cv.headerEmail)}
          value={header.email}
          onCommit={(email) => set({ email })}
        />
        <DraftInput
          id="cv-phone"
          label={t(m.cv.headerPhone)}
          value={header.phone}
          onCommit={(phone) => set({ phone })}
        />
        <DraftInput
          id="cv-location"
          label={t(m.cv.headerLocation)}
          value={header.location}
          placeholder={t(m.cv.headerLocationPlaceholder)}
          onCommit={(location) => set({ location })}
        />
        <DraftInput
          id="cv-link"
          label={t(m.cv.headerLink)}
          value={header.links[0]?.url ?? ""}
          placeholder={t(m.cv.headerLinkPlaceholder)}
          onCommit={(url) =>
            set({ links: url ? [{ label: url, url }] : [] })
          }
        />
      </div>

      <Button asChild variant="outline" size="sm">
        <Link
          href={`/coach?q=${encodeURIComponent(t(m.cv.askCoachPrompt(resume.label)))}`}
        >
          <CoachCat size="sm" />
          {t(m.cv.askCoachToRewrite)}
        </Link>
      </Button>
    </div>
  );
}

/* ── Add section ─────────────────────────────────────────── */

function AddSectionMenu({ resume }: { resume: Resume }) {
  const dispatch = useDispatch();
  const { t, m, locale } = useT();
  const used = new Set(resume.sections.map((s) => s.kind));
  // `custom` is always offerable; the rest are one each, because two sections
  // called "Học vấn" is a mistake rather than a choice.
  const available = sectionOrder.filter(
    (kind) => kind === "custom" || !used.has(kind),
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="w-full">
          <Plus className="size-3.5" />
          {t(m.cv.addSection)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {available.map((kind: ResumeSectionKind) => (
          <DropdownMenuItem
            key={kind}
            onSelect={() =>
              dispatch(
                "resume.addSection",
                { id: resume.id, kind },
                { silent: true },
              )
            }
          >
            {/* Named in the app's language here, but created in the CV's:
                this is a menu, and the heading it produces is a document. */}
            {sectionDefaults[kind].heading[locale]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
