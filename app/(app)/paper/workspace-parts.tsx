"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ChevronDown,
  Copy,
  Download,
  FileDown,
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
  themeForTemplate,
} from "@/lib/paper/cv";
import type { CvPaper, CvSectionKind, CvTemplate } from "@/lib/paper/types";
import { useT } from "@/lib/i18n/use-t";

export function EditorMainBar({
  currentId,
  currentLabel,
  nameLabel,
  typeLabel,
  onRename,
  onDelete,
  deleteLabel,
  onBack,
  trailing,
}: {
  currentId: string;
  currentLabel: string;
  nameLabel: string;
  typeLabel: string;
  onRename: (label: string) => void;
  onDelete: () => void;
  deleteLabel: string;
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
          aria-label={t(m.paper.backToList)}
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
          className="min-w-0 max-w-[12rem] gap-0 sm:max-w-[14rem] [&_input]:h-7 [&_input]:border-0 [&_input]:bg-transparent [&_input]:px-1.5 [&_input]:text-base [&_input]:font-medium [&_input]:shadow-none sm:[&_input]:text-sm"
        />
        <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
          {typeLabel}
        </span>
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

      <div className="flex items-center gap-1">{trailing}</div>
    </PaperToolbar>
  );
}

export function FormatBar({ cv }: { cv: CvPaper }) {
  const dispatch = useDispatch();
  const { t, m } = useT();
  const styleLabels: Record<CvTemplate, string> = {
    classic: t(m.paper.cv.templateClassic),
    internship: t(m.paper.cv.templateInternship),
    academic: t(m.paper.cv.templateAcademic),
    service: t(m.paper.cv.templateService),
    compact: t(m.paper.cv.templateCompact),
    modern: t(m.paper.cv.templateModern),
    technical: t(m.paper.cv.templateTechnical),
    design: t(m.paper.cv.templateDesign),
  };
  const current = cv.theme.template;
  const fit = cv.theme.density === "tight";

  return (
    <PaperToolbar compact>
      <div className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto">
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="text-xs text-muted-foreground">
            {t(m.paper.cv.template)}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 max-w-[14rem]"
                aria-label={`${t(m.paper.cv.template)}: ${styleLabels[current]}`}
              >
                <span className="truncate">{styleLabels[current]}</span>
                <ChevronDown className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              {templates.map((key) => (
                <DropdownMenuItem
                  key={key}
                  onSelect={() =>
                    dispatch(
                      "paper.setTheme",
                      { id: cv.id, ...themeForTemplate[key] },
                      { silent: true },
                    )
                  }
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{styleLabels[key]}</span>
                    {key === "design" && (
                      <span className="text-pretty text-xs text-muted-foreground">
                        {t(m.paper.cv.templateDesignHint)}
                      </span>
                    )}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
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
              { id: cv.id, density: fit ? "normal" : "tight" },
              { silent: true },
            )
          }
        >
          {t(m.paper.cv.fitOnePage)}
        </Button>

        <SectionsMenu cv={cv} />
      </div>

      <MoreMenu cv={cv} />
    </PaperToolbar>
  );
}

function SectionsMenu({ cv }: { cv: CvPaper }) {
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
        {cv.sections.map((section, index) => (
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
                  { id: cv.id, sectionId: section.id, by: -1 },
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
              disabled={index === cv.sections.length - 1}
              aria-label={t(m.paper.cv.moveSectionDown(section.heading))}
              onClick={() =>
                dispatch(
                  "paper.moveSection",
                  { id: cv.id, sectionId: section.id, by: 1 },
                  { silent: true },
                )
              }
            >
              <ArrowDown className="size-3.5" />
            </Button>
          </div>
        ))}
        <div className="mt-1 border-t border-border pt-1">
          <AddSectionMenu cv={cv} />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function AddSectionItems({ cv }: { cv: CvPaper }) {
  const dispatch = useDispatch();
  const used = new Set(cv.sections.map((s) => s.kind));
  const available = sectionOrder.filter(
    (kind) => kind === "custom" || !used.has(kind),
  );

  return (
    <>
      {available.map((kind: CvSectionKind) => (
        <DropdownMenuItem
          key={kind}
          onSelect={() =>
            dispatch("paper.addSection", { id: cv.id, kind }, { silent: true })
          }
        >
          <Plus />
          {sectionDefaults[kind].heading}
        </DropdownMenuItem>
      ))}
    </>
  );
}

function MoreMenu({ cv }: { cv: CvPaper }) {
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
              id: cv.id,
              label: t(m.paper.cv.copySuffix(cv.label)),
            })
          }
        >
          <Copy />
          {t(m.paper.cv.duplicate)}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <ExportItems cv={cv} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ExportItems({ cv }: { cv: CvPaper }) {
  const { t, m } = useT();
  const stem = fileStem(cv);

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
        onSelect={() => save("md", toMarkdown(cv), "text/markdown")}
      >
        <Download />
        <span className="flex-1">{t(m.paper.cv.exportMarkdown)}</span>
        <span className="text-xs text-muted-foreground">.md</span>
      </DropdownMenuItem>
      <DropdownMenuItem
        onSelect={() => save("txt", toPlainText(cv), "text/plain")}
      >
        <Download />
        <span className="flex-1">{t(m.paper.cv.exportText)}</span>
        <span className="text-xs text-muted-foreground">.txt</span>
      </DropdownMenuItem>
      <DropdownMenuItem
        onSelect={() => save("json", toJson(cv), "application/json")}
      >
        <Download />
        <span className="flex-1">{t(m.paper.cv.exportJson)}</span>
        <span className="text-xs text-muted-foreground">.json</span>
      </DropdownMenuItem>
      <DropdownMenuItem
        onSelect={() => {
          void navigator.clipboard
            .writeText(toPlainText(cv))
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
        <Button
          size="sm"
          aria-label={t(m.paper.cv.exportPdf)}
          onClick={() => window.print()}
        >
          <Printer className="size-3.5" />
          <span className="hidden sm:inline">{t(m.paper.cv.exportPdf)}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{hint}</TooltipContent>
    </Tooltip>
  );
}

export function AddSectionMenu({ cv }: { cv: CvPaper }) {
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
        <AddSectionItems cv={cv} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ExportMenu({ cv }: { cv: CvPaper }) {
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
        <ExportItems cv={cv} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
