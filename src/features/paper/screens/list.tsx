import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useRef, useState, type DragEvent, type ReactNode } from "react";
import { listPapersFn } from "@/features/paper/queries";
import { isPaperUploadFile, relativeUpdated, titleFromFilename } from "@/features/paper/model";
import { NewCvCard, PaperDriveCard, PaperDriveGrid } from "@/features/paper/components/thumb";
import { runCommand } from "@/ui/run-command";
import { Button } from "@/ui/button";
import { Band } from "@/ui/band";
import { EmptyState } from "@/ui/empty-state";
import { SkeletonBlock } from "@/ui/skeleton";
import { ConfirmDialog } from "@/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu";

export function PaperListScreen() {
  const q = useQuery({ queryKey: ["papers"], queryFn: () => listPapersFn() });
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dropOver, setDropOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [removePaperId, setRemovePaperId] = useState<string | null>(null);

  async function createCv() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await runCommand<{ id: string }>("paper.create", {
        kind: "cv",
        fromProfile: true,
      });
      await navigate({ to: "/paper/$paperId", params: { paperId: result.result.id } });
    } finally {
      setBusy(false);
    }
  }

  async function openPaper(id: string) {
    await navigate({ to: "/paper/$paperId", params: { paperId: id } });
  }

  async function onUpload(file: File) {
    if (!isPaperUploadFile(file) || busy) return;
    setBusy(true);
    try {
      const bytesBase64 = await readFileAsBase64(file);
      await runCommand("paper.uploadFile", {
        filename: file.name,
        mime: file.type || "application/octet-stream",
        bytesBase64,
      });
      const created = await runCommand<{ id: string }>("paper.create", {
        kind: "cv",
        fromProfile: true,
      });
      await runCommand("paper.rename", {
        id: created.result.id,
        title: titleFromFilename(file.name),
      });
      await navigate({ to: "/paper/$paperId", params: { paperId: created.result.id } });
    } finally {
      setBusy(false);
    }
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDropOver(true);
  }

  function onDragLeave(event: DragEvent<HTMLDivElement>) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setDropOver(false);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDropOver(false);
    const file = [...event.dataTransfer.files].find(isPaperUploadFile);
    if (file) void onUpload(file);
  }

  const papers = q.data?.papers ?? [];

  return (
    <div>
      <Band
        title="Paper"
        primary={
          <Button disabled={busy} onClick={() => void createCv()}>
            New CV
          </Button>
        }
        secondary={
          <>
            <Button variant="ghost" disabled={busy} onClick={() => fileInputRef.current?.click()}>
              Upload
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              className="sr-only"
              aria-label="Upload"
              accept=".pdf,.doc,.docx"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void onUpload(file);
              }}
            />
          </>
        }
      />

      {q.isPending ? (
        <PaperDriveGrid>
          <GridSkeleton dashed />
          <GridSkeleton />
        </PaperDriveGrid>
      ) : q.isError ? (
        <EmptyState
          kind="error"
          title="Couldn't load Paper. Try again."
          action={
            <Button variant="outline" onClick={() => void q.refetch()}>
              Try again
            </Button>
          }
        />
      ) : (
        <PaperDriveGrid
          dropOver={dropOver}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <NewCvCard onSelect={() => void createCv()} />
          {papers.map((paper) => (
            <PaperDriveCard
              key={paper.id}
              kind={paper.kind}
              content={paper.content}
              title={paper.title}
              updated={relativeUpdated(paper.updated_at)}
              onSelect={() => void openPaper(paper.id)}
              menu={
                <CardMenu label={paper.title}>
                  <DropdownMenuItem onSelect={() => void openPaper(paper.id)}>Open</DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() =>
                      void runCommand<{ id: string }>("paper.duplicate", { id: paper.id }).then((r) =>
                        openPaper(r.result.id),
                      )
                    }
                  >
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onSelect={() => setRemovePaperId(paper.id)}
                  >
                    Delete
                  </DropdownMenuItem>
                </CardMenu>
              }
            />
          ))}
        </PaperDriveGrid>
      )}

      <ConfirmDialog
        open={Boolean(removePaperId)}
        onOpenChange={(open) => !open && setRemovePaperId(null)}
        title="Delete this document?"
        body="This removes the document. It cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          if (!removePaperId) return;
          void runCommand("paper.remove", { id: removePaperId }).then(() => q.refetch());
          setRemovePaperId(null);
        }}
      />
    </div>
  );
}

function GridSkeleton({ dashed = false }: { dashed?: boolean }) {
  return (
    <div>
      <div
        className={
          dashed
            ? "w-full overflow-hidden rounded-[var(--radius-container)] border border-dashed border-hairline"
            : "w-full overflow-hidden rounded-[var(--radius-container)]"
        }
        style={{ aspectRatio: "1 / 1.41421356237" }}
      >
        <SkeletonBlock className="h-full w-full rounded-[var(--radius-container)]" />
      </div>
      <SkeletonBlock className="mt-3 h-3 w-24" />
      {dashed ? null : <SkeletonBlock className="mt-1 h-3 w-20" />}
    </div>
  );
}

function CardMenu({ label, children }: { label: string; children: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Actions for ${label}`}
        className="flex size-11 items-center justify-center rounded-[var(--radius-control)] text-[13px] hover:bg-surface-2"
      >
        ···
      </DropdownMenuTrigger>
      <DropdownMenuContent>{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result ?? "");
      resolve(value.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
