"use client";

import * as React from "react";
import { Download, FileDown, FilePlus2, Printer, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useCoach } from "@/components/coach/provider";
import { ParagraphEditor } from "@/components/papers/paragraph-editor";
import { PaperPrintPortal } from "@/components/papers/paper-print";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppState, useDispatch, useTouched } from "@/lib/actions/store";
import { download } from "@/lib/cv/export";
import { fileStem, toMarkdown, toPlainText } from "@/lib/papers/export";
import {
  paperKindLabels,
  paperKinds,
  type PaperKind,
  type ProseDocument,
} from "@/lib/papers/types";
import { localeNames, locales } from "@/lib/i18n/locale";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

/**
 * Cover letters and project write-ups.
 *
 * A deliberately lighter surface than `/cv`. A résumé needs a section editor, a
 * header editor and an A4 preview because it *is* structure; a letter is
 * paragraphs, and giving it the same machinery would be dressing four sentences
 * up as a document management system.
 */
export default function PapersPage() {
  const { papers } = useAppState();
  const { t, m } = useT();
  const dispatch = useDispatch();

  // Which document is open. Held here rather than in the URL because switching
  // between two letters is not a place anybody links to.
  const [openId, setOpenId] = React.useState<string | null>(null);
  const open = papers.find((paper) => paper.id === openId) ?? papers[0] ?? null;

  const create = (kind: PaperKind) => {
    dispatch("paper.create", {
      kind,
      label: paperKindLabels[kind].vi,
    });
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t(m.papers.title)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t(m.papers.lead)}</p>
        </div>
        <div className="flex items-center gap-2">
          {paperKinds.map((kind) => (
            <Button
              key={kind}
              variant={kind === "cover-letter" ? "default" : "outline"}
              size="sm"
              onClick={() => create(kind)}
            >
              <FilePlus2 className="size-3.5" />
              {t(kind === "cover-letter" ? m.papers.newCoverLetter : m.papers.newWriteUp)}
            </Button>
          ))}
        </div>
      </header>

      {papers.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <DocumentList papers={papers} openId={open?.id ?? null} onOpen={setOpenId} />
          {open && <Editor paper={open} />}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  const { t, m } = useT();
  return (
    <div className="mt-10 rounded-xl border bg-card px-6 py-12 text-center">
      <h2 className="text-base font-semibold tracking-tight">{t(m.papers.emptyTitle)}</h2>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
        {t(m.papers.emptyBody)}
      </p>
    </div>
  );
}

/** The rail of documents. A divided list, not a grid of cards. */
function DocumentList({
  papers,
  openId,
  onOpen,
}: {
  papers: ProseDocument[];
  openId: string | null;
  onOpen: (id: string) => void;
}) {
  const { t, m, locale } = useT();
  const touched = useTouched();

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="divide-y divide-border">
        {papers.map((paper) => (
          <button
            key={paper.id}
            onClick={() => onOpen(paper.id)}
            aria-current={paper.id === openId}
            className={cn(
              "flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left transition-colors duration-[var(--duration-press)] hover:bg-muted/40 motion-reduce:transition-none",
              paper.id === openId && "bg-muted/60",
              // What the last change touched, flashed for a moment so a Coach
              // edit is something the user can locate rather than just be told
              // about.
              touched.includes(paper.id) && "bg-muted",
            )}
          >
            <span className="w-full truncate text-sm font-medium">
              {paper.label || t(m.papers.untitled)}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {paperKindLabels[paper.kind][locale]} · {paper.updatedAt}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Editor({ paper }: { paper: ProseDocument }) {
  const { t, m, locale } = useT();
  const dispatch = useDispatch();

  return (
    <div className="min-w-0">
      <div className="rounded-xl border bg-card">
        <div className="grid gap-4 border-b border-border p-4 sm:grid-cols-2">
          <Field label={t(m.papers.labelField)}>
            <TextField
              value={paper.label}
              placeholder={t(m.papers.labelPlaceholder)}
              onCommit={(label) =>
                label && dispatch("paper.rename", { id: paper.id, label }, { silent: true })
              }
            />
          </Field>
          <Field label={t(m.papers.targetRoleField)}>
            <TextField
              value={paper.targetRole ?? ""}
              placeholder={t(m.papers.targetRolePlaceholder)}
              onCommit={(targetRole) =>
                dispatch("paper.rename", { id: paper.id, targetRole }, { silent: true })
              }
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
          {/* The document's own language, not the app's: applying abroad means
              an English letter while still reading the interface in
              Vietnamese. */}
          <div className="flex items-center gap-1">
            {locales.map((code) => (
              <Button
                key={code}
                variant={paper.language === code ? "secondary" : "ghost"}
                size="sm"
                className={paper.language === code ? undefined : "text-muted-foreground"}
                onClick={() =>
                  dispatch("paper.rename", { id: paper.id, language: code }, { silent: true })
                }
              >
                {localeNames[code]}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <AskCoach paper={paper} />
            <ExportMenu paper={paper} />
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => window.print()}
            >
              <Printer className="size-3.5" />
              <span className="hidden sm:inline">PDF</span>
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t(m.common.delete)}
              className="text-muted-foreground"
              onClick={() => dispatch("paper.remove", { id: paper.id })}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>

        <div className="p-4">
          <ParagraphEditor paper={paper} />
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {paperKindLabels[paper.kind][locale]}
      </p>

      {/* Only the open document goes to the printer. */}
      <PaperPrintPortal paper={paper} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const id = React.useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <div id={id}>{children}</div>
    </div>
  );
}

/** A text input that dispatches on blur rather than on every keystroke. */
function TextField({
  value,
  placeholder,
  onCommit,
}: {
  value: string;
  placeholder: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = React.useState(value);
  const [given, setGiven] = React.useState(value);
  if (value !== given) {
    setGiven(value);
    setDraft(value);
  }

  return (
    <Input
      value={draft}
      placeholder={placeholder}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => draft !== value && onCommit(draft.trim())}
      className="h-9 text-sm"
    />
  );
}

/**
 * Hands the Coach the request the user would otherwise have to go and type.
 *
 * The label and the target role are already on screen, so the request carries
 * them: a Coach asked to "write a draft" with no idea which document is open
 * would have to ask, and the user would have to answer something the page
 * already knows.
 */
function AskCoach({ paper }: { paper: ProseDocument }) {
  const { t, m, locale } = useT();
  const thread = useCoach();

  const request = [
    m.papers.askCoachPrompt[locale],
    paper.label && `(${paper.label}${paper.targetRole ? `, ${paper.targetRole}` : ""})`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-muted-foreground"
      disabled={thread.busy}
      onClick={() => thread.send(request)}
    >
      <Sparkles className="size-3.5" />
      <span className="hidden sm:inline">{t(m.papers.askCoach)}</span>
    </Button>
  );
}

function ExportMenu({ paper }: { paper: ProseDocument }) {
  const { t, m } = useT();
  const stem = fileStem(paper);

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
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-muted-foreground">
          {t(m.cv.exportDownload)}
        </DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => save("md", toMarkdown(paper), "text/markdown")}>
          <Download />
          <span className="flex-1">{t(m.cv.exportMarkdown)}</span>
          <span className="text-xs text-muted-foreground">.md</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => save("txt", toPlainText(paper), "text/plain")}>
          <Download />
          <span className="flex-1">{t(m.cv.exportText)}</span>
          <span className="text-xs text-muted-foreground">.txt</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
