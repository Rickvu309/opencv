"use client";

import * as React from "react";
import { MoreHorizontal, Plus } from "lucide-react";

import { QuietCoachOffer } from "@/components/coach/quiet-offer";
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
import { sheetTransitionName } from "@/lib/paper/room";
import {
  isCvPaper,
  isProofPaper,
  paperTypeLabels,
  type Paper,
  type PaperUpload,
} from "@/lib/paper/types";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";
export type DriveFilter = "all" | "cv" | "letter" | "proof" | "upload";

const rowFocus =
  "outline-none hover:bg-transparent focus-visible:ring-3 focus-visible:ring-ring/50";

const warmInk = "text-[oklch(0.52_0.11_55)]";
const warmSlab = "bg-[oklch(0.52_0.11_55)]";

export function Drive({
  filter,
  onOpen,
  onRequestCreateCv,
  onWillCreate,
}: {
  filter: DriveFilter;
  onOpen: (id: string, extras?: { fromUpload?: boolean }) => void;
  onRequestCreateCv: () => void;
  onWillCreate: (opts?: { fromUpload?: boolean }) => void;
}) {
  const { paper, uploads } = useAppState();
  const dispatch = useDispatch();
  const { t, m } = useT();
  const [unsigned, setUnsigned] = React.useState<Record<string, true>>({});

  const startCvFromFile = () => {
    const n = paper.filter(isCvPaper).length + 1;
    onWillCreate({ fromUpload: true });
    dispatch(
      "paper.create",
      {
        type: "cv",
        label: t(m.paper.cv.untitled(n)),
        template: "compact",
        fromProfile: false,
      },
      { silent: true },
    );
  };

  const empty = paper.length === 0 && uploads.length === 0;
  const uploadsOnly = paper.length === 0 && uploads.length > 0;
  const present = new Set<DriveFilter>([
    ...paper.map((item) => item.type as DriveFilter),
    ...(uploads.length > 0 ? (["upload"] as const) : []),
  ]);
  const activeFilter = filter === "all" || present.has(filter) ? filter : "all";

  const rows = [
    ...paper.map((item) => ({ kind: "paper" as const, item })),
    ...uploads.map((item) => ({ kind: "upload" as const, item })),
  ].filter((row) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "upload") return row.kind === "upload";
    return row.kind === "paper" && row.item.type === activeFilter;
  });

  const airy = rows.length <= 4;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
        {empty ? (
          <div className="max-w-xl space-y-3">
            <h1 className="sr-only">{t(m.paper.yourDocuments)}</h1>
            <button
              type="button"
              onClick={onRequestCreateCv}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-1 py-3 text-start",
                rowFocus,
              )}
            >
              <Slab warm className="unmade-slab" />
              <span className={cn("text-sm font-medium", warmInk)}>
                {t(m.paper.emptyTitle)}
              </span>
            </button>
            <EmptyUpload
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
              onStarted={startCvFromFile}
            />
          </div>
        ) : (
          <>
            <h1 className="sr-only">{t(m.paper.yourDocuments)}</h1>
            {uploadsOnly && (
              <p className="mb-4 text-pretty text-sm text-muted-foreground">
                {t(m.paper.emptyUploadsOnly)}
              </p>
            )}
            {rows.length === 0 ? (
              <p className="py-6 text-pretty text-sm text-muted-foreground">
                {t(m.paper.noRowsForFilter)}
              </p>
            ) : (
              <ul className={cn(airy ? "space-y-1" : "space-y-0")}>
                {rows.map((row) =>
                  row.kind === "paper" ? (
                    <PaperRow
                      key={row.item.id}
                      paper={row.item}
                      airy={airy}
                      onOpen={() => onOpen(row.item.id)}
                    />
                  ) : (
                    <UploadRow
                      key={row.item.id}
                      upload={row.item}
                      airy={airy}
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
                      onStartCv={startCvFromFile}
                    />
                  ),
                )}
              </ul>
            )}
            <div className="mt-8">
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

export function DriveBand({
  filter,
  onFilter,
  onRequestCreateCv,
  onRequestCreateLetter,
  onWillCreate,
}: {
  filter: DriveFilter;
  onFilter: (filter: DriveFilter) => void;
  onRequestCreateCv: () => void;
  onRequestCreateLetter: () => void;
  onWillCreate: (opts?: { fromUpload?: boolean }) => void;
}) {
  const { paper, uploads } = useAppState();
  const dispatch = useDispatch();
  const { t, m } = useT();
  const empty = paper.length === 0 && uploads.length === 0;
  const present = new Set<DriveFilter>([
    ...paper.map((item) => item.type as DriveFilter),
    ...(uploads.length > 0 ? (["upload"] as const) : []),
  ]);
  const showFilter = present.size > 1;
  const activeFilter = filter === "all" || present.has(filter) ? filter : "all";
  const filterOptions = (
    [
      ["all", t(m.paper.filterAll)],
      ["cv", t(m.paper.kindCv)],
      ["letter", t(m.paper.kindLetter)],
      ["proof", t(m.paper.kindProof)],
      ["upload", t(m.paper.kindUploaded)],
    ] as const
  ).filter(([key]) => key === "all" || present.has(key));

  if (empty) {
    return <h1 className="sr-only">{t(m.paper.yourDocuments)}</h1>;
  }

  return (
    <>
      <NewMenu
        onCreateCv={onRequestCreateCv}
        onCreateLetter={onRequestCreateLetter}
        onCreateProof={() => {
          onWillCreate();
          dispatch("paper.create", {
            type: "proof",
            label: t(m.paper.proof.untitled),
          });
        }}
        onKeepFailed={() => undefined}
        onKept={() => undefined}
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
              onClick={() => onFilter(key)}
            >
              {label}
            </Button>
          ))}
        </div>
      )}
    </>
  );
}

function Slab({
  warm,
  file,
  className,
  transitionName,
}: {
  warm?: boolean;
  file?: boolean;
  className?: string;
  transitionName?: string;
}) {
  return (
    <span
      aria-hidden
      style={transitionName ? { viewTransitionName: transitionName } : undefined}
      className={cn(
        "block h-7 w-0.5 shrink-0 rounded-full",
        file
          ? "w-px bg-muted-foreground/40"
          : warm
            ? warmSlab
            : "bg-foreground/70",
        className,
      )}
    />
  );
}

function PaperRow({
  paper,
  airy,
  onOpen,
}: {
  paper: Paper;
  airy: boolean;
  onOpen: () => void;
}) {
  const { t, m } = useT();
  const dispatch = useDispatch();
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
          "grid w-full items-center gap-3 rounded-md pe-10 text-start text-sm sm:grid-cols-[minmax(0,1fr)_7rem_6rem] sm:pe-12",
          airy ? "py-3.5" : "py-2.5",
          rowFocus,
        )}
      >
        <span className="flex min-w-0 items-center gap-3">
          <Slab
            className={`paper-slab-${paper.id}`}
            transitionName={sheetTransitionName(paper.id)}
          />
          <span className="min-w-0">
            <span
              className="block truncate font-medium"
              style={{ viewTransitionName: `paper-name-${paper.id}` }}
            >
              {name}
            </span>
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
  airy,
  keepFailed,
  onKeepFailed,
  onKept,
  onStartCv,
}: {
  upload: PaperUpload;
  airy: boolean;
  keepFailed: boolean;
  onKeepFailed: () => void;
  onKept: () => void;
  onStartCv: () => void;
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
          "grid w-full items-center gap-3 rounded-md text-start text-sm sm:grid-cols-[minmax(0,1fr)_7rem_6rem]",
          airy ? "py-3.5" : "py-2.5",
          rowFocus,
        )}
      >
        <span className="flex min-w-0 items-center gap-3">
          <Slab file />
          <span className="min-w-0">
            <span className="block truncate font-medium">{upload.label}</span>
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
      </button>
      {open && (
        <div
          id={panelId}
          className="mb-2 ms-4 space-y-2 border-s border-border ps-4"
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
            <Button size="sm" onClick={onStartCv}>
              {t(m.paper.startCvFromFile)}
            </Button>
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

function putUpload(
  id: string,
  file: File,
  onKeepFailed: (id: string) => void,
  onKept: (id: string) => void,
) {
  void fetch(`/api/paper-file?uploadId=${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: {
      "content-type": file.type || mimeFromName(file.name) || "application/pdf",
      "x-file-name": file.name,
    },
    body: file,
  }).then((response) => {
    if (response.status === 401) onKeepFailed(id);
    else if (response.ok) onKept(id);
  });
}

function useAddUpload() {
  const { uploads } = useAppState();
  const dispatch = useDispatch();

  return (file: File) => {
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
    return id;
  };
}

function EmptyUpload({
  onKeepFailed,
  onKept,
  onStarted,
}: {
  onKeepFailed: (id: string) => void;
  onKept: (id: string) => void;
  onStarted: () => void;
}) {
  const { t, m } = useT();
  const addUpload = useAddUpload();
  const fileRef = React.useRef<HTMLInputElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className={cn(
          "flex w-full items-center gap-3 rounded-md px-1 py-2 text-start text-sm text-muted-foreground",
          rowFocus,
        )}
      >
        <Slab file />
        <span>{t(m.paper.alreadyHaveFile)}</span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.doc,.docx,application/pdf"
        className="sr-only"
        aria-label={t(m.paper.alreadyHaveFile)}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          const id = addUpload(file);
          putUpload(id, file, onKeepFailed, onKept);
          onStarted();
        }}
      />
    </>
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
  const addUpload = useAddUpload();
  const fileRef = React.useRef<HTMLInputElement>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn("border-current", warmInk)}
          >
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
          const id = addUpload(file);
          putUpload(id, file, onKeepFailed, onKept);
        }}
      />
    </>
  );
}
