"use client";

import * as React from "react";
import { FileText, FileUp, Mail, MoreHorizontal, NotebookPen, Plus } from "lucide-react";

import { QuietCoachOffer } from "@/components/coach/quiet-offer";
import { PaperToolbar } from "@/components/paper/toolbar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppState, useDispatch } from "@/lib/actions/store";
import { nextId } from "@/lib/ids";
import { wordForTemplate } from "@/lib/paper/cv";
import { mimeFromName } from "@/lib/paper/files";
import {
  isCvPaper,
  isLetterPaper,
  isProofPaper,
  paperTypeLabels,
  type Paper,
  type PaperUpload,
} from "@/lib/paper/types";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

type Filter = "all" | "cv" | "letter" | "proof" | "upload";

const rowFocus =
  "outline-none hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/50";

export function Library({
  onOpen,
  onCreateCv,
  onCreateLetter,
  onCreateProof,
}: {
  onOpen: (id: string) => void;
  onCreateCv: () => void;
  onCreateLetter: () => void;
  onCreateProof: () => void;
}) {
  const { paper, uploads, profile } = useAppState();
  const { t, m } = useT();
  const [filter, setFilter] = React.useState<Filter>("all");
  const [unsigned, setUnsigned] = React.useState<Record<string, true>>({});
  const empty = paper.length === 0 && uploads.length === 0;
  const hasName = Boolean(profile.identity.name.trim());
  const uploadsOnly = paper.length === 0 && uploads.length > 0;
  const present = new Set<Filter>([
    ...paper.map((item) => item.type as Filter),
    ...(uploads.length > 0 ? (["upload"] as const) : []),
  ]);
  const showFilter = present.size > 1;
  const activeFilter = filter === "all" || present.has(filter) ? filter : "all";

  const rows = [
    ...paper.map((item) => ({ kind: "paper" as const, item })),
    ...uploads.map((item) => ({ kind: "upload" as const, item })),
  ].filter((row) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "upload") return row.kind === "upload";
    return row.kind === "paper" && row.item.type === activeFilter;
  });

  const filterOptions = (
    [
      ["all", t(m.paper.filterAll)],
      ["cv", t(m.paper.kindCv)],
      ["letter", t(m.paper.kindLetter)],
      ["proof", t(m.paper.kindProof)],
      ["upload", t(m.paper.kindUploaded)],
    ] as const
  ).filter(([key]) => key === "all" || present.has(key));

  return (
    <div className="flex h-full min-h-0 flex-col">
      {!empty && (
        <PaperToolbar>
          <NewMenu
            onCreateCv={onCreateCv}
            onCreateLetter={onCreateLetter}
            onCreateProof={onCreateProof}
            onKeepFailed={(id) =>
              setUnsigned((current) => ({ ...current, [id]: true }))
            }
            onKept={(id) =>
              setUnsigned((current) => {
                if (!current[id]) return current;
                const next = { ...current };
                delete next[id];
                return next;
              })
            }
          />
          {showFilter && (
            <div
              role="group"
              aria-label={t(m.paper.filterByType)}
              className="ms-auto flex flex-wrap gap-1"
            >
              {filterOptions.map(([key, label]) => (
                <Button
                  key={key}
                  type="button"
                  size="sm"
                  variant={activeFilter === key ? "secondary" : "ghost"}
                  aria-pressed={activeFilter === key}
                  className="h-7"
                  onClick={() => setFilter(key)}
                >
                  {label}
                </Button>
              ))}
            </div>
          )}
        </PaperToolbar>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {empty ? (
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="px-4 py-3">
              <h1 className="text-pretty text-sm font-semibold tracking-tight">
                {t(m.paper.emptyTitle)}
              </h1>
              <p className="mt-1 text-pretty text-sm text-muted-foreground">
                {t(
                  hasName
                    ? m.paper.emptyWithProfile
                    : m.paper.emptyWithoutProfile,
                )}
              </p>
            </div>
            <div className="border-t border-border p-2">
              <Button
                className="h-auto min-h-10 w-full justify-start"
                onClick={onCreateCv}
              >
                {t(m.paper.buildCv)}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <h1 className="sr-only">{t(m.paper.yourDocuments)}</h1>
            {uploadsOnly && (
              <p className="mb-3 text-pretty text-sm text-muted-foreground">
                {t(m.paper.emptyUploadsOnly)}
              </p>
            )}
            <div className="mb-1 hidden grid-cols-[minmax(0,1fr)_7rem_6rem_1.75rem] items-center gap-3 px-3 text-xs text-muted-foreground sm:grid">
              <span>{t(m.paper.nameColumn)}</span>
              <span>{t(m.paper.kindColumn)}</span>
              <span className="text-end">{t(m.paper.updatedColumn)}</span>
              <span className="sr-only">{t(m.paper.more)}</span>
            </div>
            {rows.length === 0 ? (
              <p className="px-3 py-6 text-pretty text-sm text-muted-foreground">
                {t(m.paper.noRowsForFilter)}
              </p>
            ) : (
              <ul>
                {rows.map((row) =>
                  row.kind === "paper" ? (
                    <PaperRow
                      key={row.item.id}
                      paper={row.item}
                      onOpen={() => onOpen(row.item.id)}
                    />
                  ) : (
                    <UploadRow
                      key={row.item.id}
                      upload={row.item}
                      keepFailed={Boolean(unsigned[row.item.id])}
                      onKeepFailed={() =>
                        setUnsigned((current) => ({
                          ...current,
                          [row.item.id]: true,
                        }))
                      }
                      onKept={() =>
                        setUnsigned((current) => {
                          if (!current[row.item.id]) return current;
                          const next = { ...current };
                          delete next[row.item.id];
                          return next;
                        })
                      }
                    />
                  ),
                )}
              </ul>
            )}
            <div className="mt-4">
              <QuietCoachOffer
                label={t(m.paper.askCoachList)}
                prompt={t(m.paper.askCoachListPrompt)}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PaperRow({ paper, onOpen }: { paper: Paper; onOpen: () => void }) {
  const { t, m } = useT();
  const dispatch = useDispatch();
  const Icon = isCvPaper(paper)
    ? FileText
    : isLetterPaper(paper)
      ? Mail
      : NotebookPen;
  const typeWord = isCvPaper(paper)
    ? wordForTemplate(paper.theme.template)
    : t(paperTypeLabels[paper.type]);
  const name =
    paper.label ||
    (isProofPaper(paper)
      ? t(m.paper.proof.untitled)
      : t(m.paper.letter.untitled));

  return (
    <li className="relative">
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "grid w-full items-center gap-3 rounded-lg px-3 py-2.5 pe-10 text-start text-sm sm:grid-cols-[minmax(0,1fr)_7rem_6rem] sm:pe-12",
          rowFocus,
        )}
      >
        <span className="flex min-w-0 items-center gap-3">
          <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0">
            <span className="block truncate font-medium">{name}</span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground sm:hidden">
              {typeWord}
              <span aria-hidden> · </span>
              <span className="tabular-nums">{paper.updatedAt}</span>
            </span>
          </span>
        </span>
        <span className="hidden truncate text-xs text-muted-foreground sm:block">
          {typeWord}
        </span>
        <span className="hidden text-end text-xs text-muted-foreground tabular-nums sm:block">
          {paper.updatedAt}
        </span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t(m.paper.rowActions)}
            className="absolute end-1.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          >
            <MoreHorizontal className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onSelect={() =>
              dispatch("paper.duplicate", {
                id: paper.id,
                label: t(m.paper.cv.copySuffix(name)),
              })
            }
          >
            {isCvPaper(paper) ? t(m.paper.cv.duplicate) : t(m.paper.duplicate)}
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => dispatch("paper.remove", { id: paper.id })}
          >
            {t(m.common.delete)}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

function UploadRow({
  upload,
  keepFailed,
  onKeepFailed,
  onKept,
}: {
  upload: PaperUpload;
  keepFailed: boolean;
  onKeepFailed: () => void;
  onKept: () => void;
}) {
  const { t, m } = useT();
  const dispatch = useDispatch();
  const [open, setOpen] = React.useState(false);
  const replaceRef = React.useRef<HTMLInputElement>(null);
  const panelId = `upload-panel-${upload.id}`;
  const href = `/api/paper-file?uploadId=${encodeURIComponent(upload.id)}`;

  const remove = async () => {
    await fetch(href, { method: "DELETE" }).catch(() => undefined);
    dispatch("paper.removeUpload", { id: upload.id });
  };

  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "grid w-full items-center gap-3 rounded-lg px-3 py-2.5 text-start text-sm sm:grid-cols-[minmax(0,1fr)_7rem_6rem_1.75rem]",
          rowFocus,
        )}
      >
        <span className="flex min-w-0 items-center gap-3">
          <FileUp className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0">
            <span className="block truncate font-medium">{upload.label}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {upload.fileName}
            </span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground sm:hidden">
              {t(m.paper.kindUploaded)}
              <span aria-hidden> · </span>
              <span className="tabular-nums">{upload.updatedAt}</span>
            </span>
          </span>
        </span>
        <span className="hidden truncate text-xs text-muted-foreground sm:block">
          {t(m.paper.kindUploaded)}
        </span>
        <span className="hidden text-end text-xs text-muted-foreground tabular-nums sm:block">
          {upload.updatedAt}
        </span>
        <span className="hidden sm:block" />
      </button>
      {open && (
        <div
          id={panelId}
          className="mb-2 ms-8 space-y-2 rounded-lg border bg-card p-3"
        >
          {upload.mime === "application/pdf" || upload.fileName.endsWith(".pdf") ? (
            <iframe title={upload.fileName} src={href} className="h-64 w-full rounded-md border" />
          ) : (
            <p className="text-sm text-muted-foreground">{upload.fileName}</p>
          )}
          {keepFailed && (
            <p className="text-xs text-muted-foreground">
              {t(m.paper.signInToKeepFile)}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" asChild>
              <a href={href} download={upload.fileName}>
                {t(m.paper.downloadFile)}
              </a>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => replaceRef.current?.click()}
            >
              {t(m.paper.replaceFile)}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void remove()}>
              {t(m.paper.deleteFile)}
            </Button>
          </div>
          <input
            ref={replaceRef}
            type="file"
            accept=".pdf,.doc,.docx,application/pdf"
            className="sr-only"
            aria-label={t(m.paper.replaceFile)}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              void fetch(href, {
                method: "PUT",
                headers: {
                  "content-type": file.type || mimeFromName(file.name) || "application/pdf",
                  "x-file-name": file.name,
                },
                body: file,
              }).then((response) => {
                if (response.status === 401) onKeepFailed();
                else if (response.ok) onKept();
              });
            }}
          />
        </div>
      )}
    </li>
  );
}

function NewMenu({
  onCreateCv,
  onCreateLetter,
  onCreateProof,
  onKeepFailed,
  onKept,
}: {
  onCreateCv: () => void;
  onCreateLetter: () => void;
  onCreateProof: () => void;
  onKeepFailed: (id: string) => void;
  onKept: (id: string) => void;
}) {
  const { t, m } = useT();
  const { uploads } = useAppState();
  const dispatch = useDispatch();
  const fileRef = React.useRef<HTMLInputElement>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Plus className="size-3.5" />
            {t(m.paper.newDocument)}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuItem onSelect={onCreateCv}>{t(m.paper.buildCv)}</DropdownMenuItem>
          <DropdownMenuItem onSelect={onCreateLetter}>
            {t(m.paper.newLetter)}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onCreateProof}>{t(m.paper.newProof)}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => fileRef.current?.click()}>
            {t(m.paper.uploadFile)}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.doc,.docx,application/pdf"
        className="sr-only"
        aria-label={t(m.paper.uploadFile)}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          const id = nextId(
            "upload",
            uploads.map((item) => item.id),
          );
          dispatch("paper.addUpload", {
            id,
            kind: "cv",
            label: file.name,
            fileName: file.name,
            mime: file.type || mimeFromName(file.name) || undefined,
            size: file.size,
          });
          void fetch(`/api/paper-file?uploadId=${encodeURIComponent(id)}`, {
            method: "PUT",
            headers: {
              "content-type":
                file.type || mimeFromName(file.name) || "application/pdf",
              "x-file-name": file.name,
            },
            body: file,
          }).then((response) => {
            if (response.status === 401) onKeepFailed(id);
            else if (response.ok) onKept(id);
          });
        }}
      />
    </>
  );
}
