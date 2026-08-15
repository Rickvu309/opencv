"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronDown,
  Copy,
  Download,
  FileDown,
  FilePlus2,
  MoreHorizontal,
  Plus,
  Printer,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { DraftInput } from "@/components/paper/draft-field";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PaperToolbar } from "@/components/paper/toolbar";
import { useDispatch } from "@/lib/actions/store";
import {
  download,
  fileStem,
  toJson,
  toMarkdown,
  toPlainText,
} from "@/lib/paper/cv-export";
import {
  sectionDefaults,
  sectionOrder,
  templates,
} from "@/lib/paper/cv";
import {
  paperTypeLabels,
  letterTypes,
  type CvPaper,
  type CvSectionKind,
  type LetterPaper,
} from "@/lib/paper/types";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

export type EditorMode = "cv" | "letter";

export function DocumentSwitcher({
  currentId,
  resumes,
  papers,
  onSelect,
  onCreateResume,
  onCreatePaper,
  extra,
}: {
  currentId: string;
  resumes: CvPaper[];
  papers: LetterPaper[];
  onSelect: (id: string) => void;
  onCreateResume: (fromProfile: boolean) => void;
  onCreatePaper: (kind: LetterType) => void;
  extra?: React.ReactNode;
}) {
  const { t, m } = useT();
  const total = resumes.length + papers.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t(m.paper.yourDocuments)}
        className="flex size-7 shrink-0 items-center justify-center rounded-md outline-none transition-colors hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
      >
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-muted-foreground">
          {total > 1
            ? `${t(m.paper.yourDocuments)} · ${t(m.paper.documentCount(total))}`
            : t(m.paper.yourDocuments)}
        </DropdownMenuLabel>
        {resumes.map((resume) => (
          <DropdownMenuItem
            key={resume.id}
            onSelect={() => onSelect(resume.id)}
          >
            <span className="min-w-0 flex-1 truncate">{resume.label}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {t(m.paper.kindCv)}
            </span>
            {resume.id === currentId && <Check className="size-3.5" />}
          </DropdownMenuItem>
        ))}
        {papers.map((paper) => (
          <DropdownMenuItem
            key={paper.id}
            onSelect={() => onSelect(paper.id)}
          >
            <span className="min-w-0 flex-1 truncate">
              {paper.label || t(m.paper.letter.untitled)}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {paperTypeLabels[paper.type]}
            </span>
            {paper.id === currentId && <Check className="size-3.5" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onCreateResume(true)}>
          <FilePlus2 />
          {t(m.paper.cv.buildFromProfile)}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onCreateResume(false)}>
          <Plus />
          {t(m.paper.cv.blankCv)}
        </DropdownMenuItem>
        {letterTypes.map((kind) => (
          <DropdownMenuItem key={kind} onSelect={() => onCreatePaper(kind)}>
            <Plus />
            {t(
              kind === "letter"
                ? m.paper.letter.newCoverLetter
                : m.paper.letter.newWriteUp,
            )}
          </DropdownMenuItem>
        ))}
        {extra}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ModeTabs({
  mode,
  onMode,
}: {
  mode: EditorMode;
  onMode: (mode: EditorMode) => void;
}) {
  const { t, m } = useT();
  return (
    <div
      role="group"
      aria-label={t(m.paper.modeSwitch)}
      className="flex rounded-md border border-border p-0.5"
    >
      <Button
        type="button"
        size="sm"
        variant={mode === "cv" ? "secondary" : "ghost"}
        aria-pressed={mode === "cv"}
        className="h-7 px-2.5"
        onClick={() => onMode("cv")}
      >
        {t(m.paper.modeCv)}
      </Button>
      <Button
        type="button"
        size="sm"
        variant={mode === "letter" ? "secondary" : "ghost"}
        aria-pressed={mode === "letter"}
        className="h-7 px-2.5"
        onClick={() => onMode("letter")}
      >
        {t(m.paper.modeLetter)}
      </Button>
    </div>
  );
}

export function EditorMainBar({
  mode,
  currentId,
  currentLabel,
  nameLabel,
  onRename,
  onDelete,
  deleteLabel,
  resumes,
  papers,
  onSelect,
  onCreateResume,
  onCreatePaper,
  onMode,
  onBack,
  trailing,
}: {
  mode: EditorMode;
  currentId: string;
  currentLabel: string;
  nameLabel: string;
  onRename: (label: string) => void;
  onDelete: () => void;
  deleteLabel: string;
  resumes: CvPaper[];
  papers: LetterPaper[];
  onSelect: (id: string) => void;
  onCreateResume: (fromProfile: boolean) => void;
  onCreatePaper: (kind: LetterType) => void;
  onMode: (mode: EditorMode) => void;
  onBack: () => void;
  trailing: React.ReactNode;
}) {
  const { t, m } = useT();

  return (
    <PaperToolbar>
      <div className="flex min-w-0 items-center gap-0.5">
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0"
          aria-label={t(m.paper.cv.backToLibrary)}
          onClick={onBack}
        >
          <ArrowLeft className="size-3.5 rtl:-scale-x-100" />
        </Button>
        <h1 className="sr-only">{currentLabel}</h1>
        <DraftInput
          id={`doc-name-${currentId}`}
          label={nameLabel}
          srLabel
          value={currentLabel}
          onCommit={(label) => label && onRename(label)}
          className="min-w-0 max-w-[12rem] gap-0 sm:max-w-[14rem] [&_input]:h-7 [&_input]:border-0 [&_input]:bg-transparent [&_input]:px-1.5 [&_input]:text-sm [&_input]:font-medium [&_input]:shadow-none [&_input]:focus-visible:ring-0"
        />
        <DocumentSwitcher
          currentId={currentId}
          resumes={resumes}
          papers={papers}
          onSelect={onSelect}
          onCreateResume={onCreateResume}
          onCreatePaper={onCreatePaper}
        />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={deleteLabel}
          className="text-muted-foreground"
          onClick={onDelete}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      <div className="flex flex-1 justify-center">
        <ModeTabs mode={mode} onMode={onMode} />
      </div>

      <div className="flex items-center gap-1">{trailing}</div>
    </PaperToolbar>
  );
}

const styleKeys = templates;
const stylePresets: Record<
  (typeof templates)[number],
  { template: string; accent: string; density: string }
> = {
  classic: { template: "classic", accent: "ink", density: "normal" },
  modern: { template: "modern", accent: "blue", density: "airy" },
  compact: { template: "compact", accent: "ink", density: "tight" },
};

export function FormatBar({ resume }: { resume: CvPaper }) {
  const dispatch = useDispatch();
  const { t, m } = useT();
  const styleLabels = {
    classic: t(m.paper.cv.styleHarvard),
    modern: t(m.paper.cv.styleMarketing),
    compact: t(m.paper.cv.styleTech),
  };
  const current = resume.theme.template;
  const fit = resume.theme.density === "tight";
  const applyStyle = (key: (typeof styleKeys)[number]) =>
    dispatch(
      "paper.setTheme",
      { id: resume.id, ...stylePresets[key] },
      { silent: true },
    );

  return (
    <PaperToolbar compact>
      <div className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto">
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{t(m.paper.cv.template)}</span>
          <div className="flex rounded-md border border-border p-0.5">
            {styleKeys.map((key) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={current === key ? "secondary" : "ghost"}
                aria-pressed={current === key}
                className="h-7 max-w-[9rem] px-2"
                onClick={() => applyStyle(key)}
              >
                <span className="truncate">{styleLabels[key]}</span>
              </Button>
            ))}
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          variant={fit ? "secondary" : "ghost"}
          aria-pressed={fit}
          className="h-7 shrink-0"
          onClick={() =>
            dispatch(
              "paper.setTheme",
              { id: resume.id, density: fit ? "normal" : "tight" },
              { silent: true },
            )
          }
        >
          {t(m.paper.cv.fitOnePage)}
        </Button>

        <SectionsMenu resume={resume} />
      </div>

      <MoreMenu resume={resume} />
    </PaperToolbar>
  );
}

function SectionsMenu({ resume }: { resume: CvPaper }) {
  const dispatch = useDispatch();
  const { t, m } = useT();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 text-muted-foreground">
          {t(m.paper.cv.sectionsMenu)}
          <ChevronDown className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 gap-1 p-1.5">
        <p className="px-2 py-1 text-xs text-muted-foreground">
          {t(m.paper.cv.outlineLabel)}
        </p>
        {resume.sections.map((section, index) => (
          <div key={section.id} className="flex items-center gap-0.5">
            <span className="min-w-0 flex-1 truncate px-2 text-sm">
              {section.heading}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={index === 0}
              aria-label={t(m.paper.cv.moveSectionUp(section.heading))}
              onClick={() =>
                dispatch(
                  "paper.moveSection",
                  { id: resume.id, sectionId: section.id, by: -1 },
                  { silent: true },
                )
              }
            >
              <ArrowUp className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={index === resume.sections.length - 1}
              aria-label={t(m.paper.cv.moveSectionDown(section.heading))}
              onClick={() =>
                dispatch(
                  "paper.moveSection",
                  { id: resume.id, sectionId: section.id, by: 1 },
                  { silent: true },
                )
              }
            >
              <ArrowDown className="size-3.5" />
            </Button>
          </div>
        ))}
        <div className="mt-1 border-t border-border pt-1">
          <AddSectionMenu resume={resume} />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function AddSectionItems({ resume }: { resume: CvPaper }) {
  const dispatch = useDispatch();
  const used = new Set(resume.sections.map((s) => s.kind));
  const available = sectionOrder.filter(
    (kind) => kind === "custom" || !used.has(kind),
  );

  return (
    <>
      {available.map((kind: CvSectionKind) => (
        <DropdownMenuItem
          key={kind}
          onSelect={() =>
            dispatch(
              "paper.addSection",
              { id: resume.id, kind },
              { silent: true },
            )
          }
        >
          <Plus />
          {sectionDefaults[kind].heading}
        </DropdownMenuItem>
      ))}
    </>
  );
}

function MoreMenu({ resume }: { resume: CvPaper }) {
  const dispatch = useDispatch();
  const { t, m } = useT();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t(m.paper.more)}
          className="text-muted-foreground"
        >
          <MoreHorizontal className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem
          onSelect={() =>
            dispatch("paper.duplicate", {
              id: resume.id,
              label: t(m.paper.cv.copySuffix(resume.label)),
            })
          }
        >
          <Copy />
          {t(m.paper.cv.duplicate)}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <ExportItems resume={resume} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ExportItems({ resume }: { resume: CvPaper }) {
  const { t, m } = useT();
  const stem = fileStem(resume);

  const save = (extension: string, contents: string, mime: string) => {
    download(`${stem}.${extension}`, contents, mime);
    toast.success(t(m.paper.cv.downloaded(`${stem}.${extension}`)));
  };

  return (
    <>
      <DropdownMenuLabel className="text-muted-foreground">
        {t(m.paper.cv.exportDownload)}
      </DropdownMenuLabel>
      <DropdownMenuItem
        onSelect={() => save("md", toMarkdown(resume), "text/markdown")}
      >
        <Download />
        <span className="flex-1">{t(m.paper.cv.exportMarkdown)}</span>
        <span className="text-xs text-muted-foreground">.md</span>
      </DropdownMenuItem>
      <DropdownMenuItem
        onSelect={() => save("txt", toPlainText(resume), "text/plain")}
      >
        <Download />
        <span className="flex-1">{t(m.paper.cv.exportText)}</span>
        <span className="text-xs text-muted-foreground">.txt</span>
      </DropdownMenuItem>
      <DropdownMenuItem
        onSelect={() => save("json", toJson(resume), "application/json")}
      >
        <Download />
        <span className="flex-1">{t(m.paper.cv.exportJson)}</span>
        <span className="text-xs text-muted-foreground">.json</span>
      </DropdownMenuItem>
      <DropdownMenuItem
        onSelect={() => {
          void navigator.clipboard
            .writeText(toPlainText(resume))
            .then(() => toast.success(t(m.paper.cv.copied)))
            .catch(() =>
              toast.error(t(m.paper.cv.copyFailedTitle), {
                description: t(m.paper.cv.copyFailedBody),
              }),
            );
        }}
      >
        <Copy />
        {t(m.paper.cv.exportCopy)}
      </DropdownMenuItem>
    </>
  );
}

export function DownloadButton({ hint }: { hint: string }) {
  const { t, m } = useT();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="size-3.5" />
          <span className="hidden sm:inline">{t(m.paper.cv.exportPdf)}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{hint}</TooltipContent>
    </Tooltip>
  );
}

export function AddSectionMenu({ resume }: { resume: CvPaper }) {
  const { t, m } = useT();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <Plus className="size-3.5" />
          {t(m.paper.cv.addSection)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <AddSectionItems resume={resume} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ExportMenu({ resume }: { resume: CvPaper }) {
  const { t, m } = useT();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <FileDown className="size-3.5" />
          <span className="hidden sm:inline">{t(m.paper.cv.exportLabel)}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <ExportItems resume={resume} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
