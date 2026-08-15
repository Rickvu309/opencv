"use client";

import * as React from "react";
import { FileText, FileUp, Mail, NotebookPen, Plus } from "lucide-react";

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

type Filter = "all" | "cv" | "letter" | "proof" | "upload";

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
  const { paper, uploads } = useAppState();
  const { t, m } = useT();
  const [filter, setFilter] = React.useState<Filter>("all");
  const empty = paper.length === 0 && uploads.length === 0;
  const uploadsOnly = paper.length === 0 && uploads.length > 0;
  const showFilter =
    new Set([
      ...paper.map((item) => item.type),
      ...(uploads.length > 0 ? ["upload"] : []),
    ]).size > 1;

  const rows = [
    ...paper.map((item) => ({ kind: "paper" as const, item })),
    ...uploads.map((item) => ({ kind: "upload" as const, item })),
  ].filter((row) => {
    if (filter === "all") return true;
    if (filter === "upload") return row.kind === "upload";
    return row.kind === "paper" && row.item.type === filter;
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PaperToolbar>
        <div className="flex flex-wrap items-center gap-2">
          {empty ? (
            <Button size="sm" onClick={onCreateCv}>
              {t(m.paper.buildCv)}
            </Button>
          ) : (
            <NewMenu
              onCreateCv={onCreateCv}
              onCreateLetter={onCreateLetter}
              onCreateProof={onCreateProof}
            />
          )}
        </div>
        {showFilter && (
          <div className="ms-auto flex gap-1">
            {(
              [
                ["all", t(m.paper.filterAll)],
                ["cv", t(m.paper.kindCv)],
                ["letter", t(m.paper.kindLetter)],
                ["proof", t(m.paper.kindProof)],
                ["upload", t(m.paper.kindUploaded)],
              ] as const
            ).map(([key, label]) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={filter === key ? "secondary" : "ghost"}
                className="h-7"
                onClick={() => setFilter(key)}
              >
                {label}
              </Button>
            ))}
          </div>
        )}
      </PaperToolbar>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {empty ? (
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="px-4 py-3">
              <h2 className="text-pretty text-sm font-semibold tracking-tight">
                {t(m.paper.emptyTitle)}
              </h2>
              <p className="mt-1 text-pretty text-sm text-muted-foreground">
                {t(m.paper.emptyWithProfile)}
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
            {uploadsOnly && (
              <p className="mb-3 text-pretty text-sm text-muted-foreground">
                {t(m.paper.emptyUploadsOnly)}
              </p>
            )}
            <div className="mb-1 grid grid-cols-[minmax(0,1fr)_8rem_8rem] gap-3 px-3 text-xs text-muted-foreground">
              <span>{t(m.paper.nameColumn)}</span>
              <span>{t(m.paper.kindColumn)}</span>
              <span className="text-end">{t(m.paper.updatedColumn)}</span>
            </div>
            <ul>
              {rows.map((row) =>
                row.kind === "paper" ? (
                  <PaperRow
                    key={row.item.id}
                    paper={row.item}
                    onOpen={() => onOpen(row.item.id)}
                  />
                ) : (
                  <UploadRow key={row.item.id} upload={row.item} />
                ),
              )}
            </ul>
            <div className="mt-4">
              <QuietCoachOffer
                label={t(m.paper.cv.askCoachHelp)}
                prompt={t(m.paper.cv.askCoachPrompt("My Paper"))}
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
  const Icon = isCvPaper(paper)
    ? FileText
    : isLetterPaper(paper)
      ? Mail
      : NotebookPen;
  const typeWord = isCvPaper(paper)
    ? wordForTemplate(paper.theme.template)
    : t(paperTypeLabels[paper.type]);

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="grid w-full grid-cols-[minmax(0,1fr)_8rem_8rem] items-center gap-3 rounded-lg px-3 py-2 text-start text-sm hover:bg-muted/70"
      >
        <span className="flex min-w-0 items-center gap-3">
          <Icon className="size-5 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium">
            {paper.label ||
              (isProofPaper(paper)
                ? t(m.paper.proof.untitled)
                : t(m.paper.letter.untitled))}
          </span>
        </span>
        <span className="truncate text-xs text-muted-foreground">{typeWord}</span>
        <span className="text-end text-xs text-muted-foreground tabular-nums">
          {paper.updatedAt}
        </span>
      </button>
    </li>
  );
}

function UploadRow({ upload }: { upload: PaperUpload }) {
  const { t, m } = useT();
  const dispatch = useDispatch();
  const [open, setOpen] = React.useState(false);
  const replaceRef = React.useRef<HTMLInputElement>(null);
  const href = `/api/paper-file?uploadId=${encodeURIComponent(upload.id)}`;

  const remove = async () => {
    await fetch(href, { method: "DELETE" }).catch(() => undefined);
    dispatch("paper.removeUpload", { id: upload.id });
  };

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="grid w-full grid-cols-[minmax(0,1fr)_8rem_8rem] items-center gap-3 rounded-lg px-3 py-2 text-start text-sm hover:bg-muted/70"
      >
        <span className="flex min-w-0 items-center gap-3">
          <FileUp className="size-5 shrink-0 text-muted-foreground" />
          <span className="min-w-0">
            <span className="block truncate font-medium">{upload.label}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {upload.fileName}
            </span>
          </span>
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {t(m.paper.kindUploaded)}
        </span>
        <span className="text-end text-xs text-muted-foreground tabular-nums">
          {upload.updatedAt}
        </span>
      </button>
      {open && (
        <div className="mb-2 ms-8 space-y-2 rounded-lg border bg-card p-3">
          {upload.mime === "application/pdf" || upload.fileName.endsWith(".pdf") ? (
            <iframe title={upload.fileName} src={href} className="h-64 w-full rounded-md border" />
          ) : (
            <p className="text-sm text-muted-foreground">{upload.fileName}</p>
          )}
          <p className="text-xs text-muted-foreground">{t(m.paper.signInToKeepFile)}</p>
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
}: {
  onCreateCv: () => void;
  onCreateLetter: () => void;
  onCreateProof: () => void;
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
          });
        }}
      />
    </>
  );
}
