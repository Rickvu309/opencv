"use client";

import * as React from "react";
import Link from "next/link";
import { FilePlus2, FileText, LayoutGrid, List, Mail, Plus } from "lucide-react";

import { ResumePreview } from "@/components/cv/resume-preview";
import { PrepareToolbar } from "@/components/prepare/workbench";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { resumeCompleteness, type Resume } from "@/lib/cv/types";
import type { LetterTarget } from "@/lib/papers/opening";
import {
  paperKindLabels,
  paperKinds,
  paragraphsOf,
  type PaperKind,
  type ProseDocument,
} from "@/lib/papers/types";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

export function Library({
  resumes,
  papers,
  hasProfile,
  targets,
  onOpenResume,
  onOpenPaper,
  onCreateResume,
  onCreatePaper,
  onCreateFromOpening,
}: {
  resumes: Resume[];
  papers: ProseDocument[];
  hasProfile: boolean;
  targets: LetterTarget[];
  onOpenResume: (id: string) => void;
  onOpenPaper: (id: string) => void;
  onCreateResume: (fromProfile: boolean) => void;
  onCreatePaper: (kind: PaperKind) => void;
  onCreateFromOpening: (target: LetterTarget) => void;
}) {
  const { t, m, locale } = useT();
  const [view, setView] = React.useState<"grid" | "list">("grid");
  const empty = resumes.length === 0 && papers.length === 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PrepareToolbar>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => onCreateResume(true)}>
            <FilePlus2 className="size-3.5" />
            {t(m.cv.buildFromProfile)}
          </Button>
          <NewMenu
            onCreateResume={onCreateResume}
            onCreatePaper={onCreatePaper}
            onCreateFromOpening={onCreateFromOpening}
            targets={targets}
          />
          {!hasProfile && (
            <Button size="sm" variant="ghost" asChild>
              <Link href="/profile">{t(m.cv.fillProfileFirst)}</Link>
            </Button>
          )}
        </div>
        {!empty && (
          <div className="ms-auto">
            <ViewToggle view={view} onView={setView} />
          </div>
        )}
      </PrepareToolbar>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {empty ? (
          <EmptyLibrary
            hasProfile={hasProfile}
            targets={targets}
            onCreateResume={onCreateResume}
            onCreatePaper={onCreatePaper}
            onCreateFromOpening={onCreateFromOpening}
          />
        ) : view === "list" ? (
          <div>
            <div className="mb-1 grid grid-cols-[minmax(0,1fr)_8rem_8rem] gap-3 px-3 text-xs text-muted-foreground">
              <span>{t(m.myPaper.nameColumn)}</span>
              <span>{t(m.myPaper.kindColumn)}</span>
              <span className="text-end">{t(m.myPaper.updatedColumn)}</span>
            </div>
            <ul>
              {resumes.map((resume) => (
                <li key={resume.id}>
                  <button
                    type="button"
                    onClick={() => onOpenResume(resume.id)}
                    className="grid w-full grid-cols-[minmax(0,1fr)_8rem_8rem] items-center gap-3 rounded-lg px-3 py-2 text-start text-sm hover:bg-muted/70"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <FileText className="size-5 shrink-0 text-muted-foreground" />
                      <span className="truncate font-medium">{resume.label}</span>
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {t(m.myPaper.kindCv)}
                    </span>
                    <span className="text-end text-xs text-muted-foreground tabular-nums">
                      {resume.updatedAt}
                    </span>
                  </button>
                </li>
              ))}
              {papers.map((paper) => (
                <li key={paper.id}>
                  <button
                    type="button"
                    onClick={() => onOpenPaper(paper.id)}
                    className="grid w-full grid-cols-[minmax(0,1fr)_8rem_8rem] items-center gap-3 rounded-lg px-3 py-2 text-start text-sm hover:bg-muted/70"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <Mail className="size-5 shrink-0 text-muted-foreground" />
                      <span className="truncate font-medium">
                        {paper.label || t(m.papers.untitled)}
                      </span>
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {paperKindLabels[paper.kind][locale]}
                    </span>
                    <span className="text-end text-xs text-muted-foreground tabular-nums">
                      {paper.updatedAt}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {resumes.map((resume) => (
              <li key={resume.id}>
                <button
                  type="button"
                  onClick={() => onOpenResume(resume.id)}
                  className="group w-full text-start"
                >
                  <div className="aspect-[210/297] overflow-hidden rounded-xl border bg-card shadow-sm ring-1 ring-black/5 group-hover:ring-foreground/20">
                    <ResumePreview resume={resume} />
                  </div>
                  <p className="mt-2 truncate text-sm font-medium">{resume.label}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {t(m.myPaper.kindCv)} · {resumeCompleteness(resume)}% · {resume.updatedAt}
                  </p>
                </button>
              </li>
            ))}
            {papers.map((paper) => (
              <li key={paper.id}>
                <button
                  type="button"
                  onClick={() => onOpenPaper(paper.id)}
                  className="group w-full text-start"
                >
                  <PaperPoster paper={paper} />
                  <p className="mt-2 truncate text-sm font-medium">
                    {paper.label || t(m.papers.untitled)}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {paperKindLabels[paper.kind][locale]} · {paper.updatedAt}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function PaperPoster({ paper }: { paper: ProseDocument }) {
  const { t, m } = useT();
  const paragraphs = paragraphsOf(paper.body);

  return (
    <div className="aspect-[210/297] overflow-hidden rounded-xl border bg-white px-7 py-8 text-neutral-900 shadow-sm ring-1 ring-black/5 group-hover:ring-foreground/20">
      {paragraphs.length === 0 ? (
        <p className="text-pretty text-sm text-neutral-400">
          {t(m.papers.emptyDocument)}
        </p>
      ) : (
        <div className="space-y-3 text-[12px] leading-5">
          {paragraphs.map((paragraph, index) => (
            <p key={index} className="whitespace-pre-wrap">
              {paragraph}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function ViewToggle({
  view,
  onView,
}: {
  view: "grid" | "list";
  onView: (view: "grid" | "list") => void;
}) {
  const { t, m } = useT();
  return (
    <div className="flex rounded-md border border-border p-0.5">
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-pressed={view === "grid"}
        aria-label={t(m.myPaper.viewGrid)}
        className={cn(view === "grid" && "bg-muted")}
        onClick={() => onView("grid")}
      >
        <LayoutGrid className="size-3.5" />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-pressed={view === "list"}
        aria-label={t(m.myPaper.viewList)}
        className={cn(view === "list" && "bg-muted")}
        onClick={() => onView("list")}
      >
        <List className="size-3.5" />
      </Button>
    </div>
  );
}

function NewMenu({
  onCreateResume,
  onCreatePaper,
  onCreateFromOpening,
  targets,
}: {
  onCreateResume: (fromProfile: boolean) => void;
  onCreatePaper: (kind: PaperKind) => void;
  onCreateFromOpening: (target: LetterTarget) => void;
  targets: LetterTarget[];
}) {
  const { t, m } = useT();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="size-3.5" />
          {t(m.myPaper.newDocument)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuItem onSelect={() => onCreateResume(false)}>
          {t(m.cv.blankCv)}
        </DropdownMenuItem>
        {paperKinds.map((kind) => (
          <DropdownMenuItem key={kind} onSelect={() => onCreatePaper(kind)}>
            {t(kind === "cover-letter" ? m.papers.newCoverLetter : m.papers.newWriteUp)}
          </DropdownMenuItem>
        ))}
        {targets.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-muted-foreground">
              {t(m.papers.newFromOpening)}
            </DropdownMenuLabel>
            {targets.slice(0, 6).map((target) => (
              <DropdownMenuItem
                key={target.opening.id}
                onSelect={() => onCreateFromOpening(target)}
              >
                <span className="min-w-0 flex-1 truncate">
                  {target.opening.title}
                  {target.opening.org ? ` · ${target.opening.org}` : ""}
                </span>
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EmptyLibrary({
  hasProfile,
  targets,
  onCreateResume,
  onCreatePaper,
  onCreateFromOpening,
}: {
  hasProfile: boolean;
  targets: LetterTarget[];
  onCreateResume: (fromProfile: boolean) => void;
  onCreatePaper: (kind: PaperKind) => void;
  onCreateFromOpening: (target: LetterTarget) => void;
}) {
  const { t, m } = useT();
  const choiceClass =
    "h-auto min-h-10 w-full justify-start gap-2 rounded-md px-2.5 py-2 text-start whitespace-normal sm:min-h-8";

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="divide-y divide-border">
        <div className="px-4 py-3">
          <h2 className="text-pretty text-sm font-semibold tracking-tight">
            {t(m.myPaper.emptyTitle)}
          </h2>
          <p className="mt-1 text-pretty text-sm text-muted-foreground">
            {t(hasProfile ? m.myPaper.emptyWithProfile : m.myPaper.emptyWithoutProfile)}
          </p>
        </div>
        <div className="p-2">
          <Button className={choiceClass} onClick={() => onCreateResume(true)}>
            <FilePlus2 className="size-4 shrink-0" />
            {t(m.cv.buildFromProfile)}
          </Button>
        </div>
        <div className="p-2">
          <Button
            variant="outline"
            className={choiceClass}
            onClick={() => onCreateResume(false)}
          >
            <Plus className="size-4 shrink-0" />
            {t(m.cv.startBlank)}
          </Button>
        </div>
        <div className="p-2">
          <Button
            variant="outline"
            className={choiceClass}
            onClick={() => onCreatePaper("cover-letter")}
          >
            <Plus className="size-4 shrink-0" />
            {t(m.papers.newCoverLetter)}
          </Button>
        </div>
        <div className="p-2">
          <Button
            variant="outline"
            className={choiceClass}
            onClick={() => onCreatePaper("project-write-up")}
          >
            <Plus className="size-4 shrink-0" />
            {t(m.papers.newWriteUp)}
          </Button>
        </div>
        {targets.slice(0, 4).map((target) => (
          <div key={target.opening.id} className="p-2">
            <Button
              variant="ghost"
              className={choiceClass}
              onClick={() => onCreateFromOpening(target)}
            >
              {t(m.papers.forOpening(target.opening.title))}
              {target.opening.org ? (
                <span className="text-muted-foreground">· {target.opening.org}</span>
              ) : null}
            </Button>
          </div>
        ))}
        {!hasProfile && (
          <div className="p-2">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-auto min-h-10 max-w-full justify-start px-2.5 whitespace-normal sm:min-h-7"
            >
              <Link href="/profile">{t(m.cv.fillProfileFirst)}</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
