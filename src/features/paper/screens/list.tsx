import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { listPapersFn } from "@/features/paper/queries";
import {
  filterPaperListRows,
  relativeUpdated,
  sortPaperListRows,
  type PaperListFilter,
} from "@/features/paper/model";
import { SituationGallery } from "@/features/paper/components/gallery";
import { runCommand } from "@/ui/run-command";
import { Button } from "@/ui/button";
import { Band, BandFilter } from "@/ui/band";
import { Row, RowList, RowListHeader } from "@/ui/rows";
import { EmptyState } from "@/ui/empty-state";
import { EndOfList } from "@/ui/card";
import { SkeletonRows } from "@/ui/skeleton";
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
  const [gallery, setGallery] = useState<"cv" | "letter" | null>(null);
  const [filter, setFilter] = useState<PaperListFilter>("all");
  const [removePaperId, setRemovePaperId] = useState<string | null>(null);
  const [removeFileId, setRemoveFileId] = useState<string | null>(null);

  async function createCv(template: string) {
    const result = await runCommand<{ id: string }>("paper.create", {
      kind: "cv",
      template,
      fromProfile: true,
    });
    await navigate({ to: "/paper/$paperId", params: { paperId: result.result.id } });
  }

  async function createLetter(situation: string) {
    const result = await runCommand<{ id: string }>("paper.create", {
      kind: "letter",
      situation,
      title: "Cover letter",
    });
    await navigate({ to: "/paper/$paperId", params: { paperId: result.result.id } });
  }

  async function onUpload(file: File) {
    const bytesBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const value = String(reader.result ?? "");
        resolve(value.split(",")[1] ?? "");
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    await runCommand("paper.uploadFile", {
      filename: file.name,
      mime: file.type || "application/octet-stream",
      bytesBase64,
    });
    await q.refetch();
  }

  async function startFromUpload() {
    const result = await runCommand<{ id: string }>("paper.create", {
      kind: "cv",
      fromProfile: true,
    });
    await navigate({ to: "/paper/$paperId", params: { paperId: result.result.id } });
  }

  const papers = q.data?.papers ?? [];
  const files = q.data?.files ?? [];
  const rows = filterPaperListRows(
    sortPaperListRows([
      ...papers.map((p) => ({
        kind: "paper" as const,
        id: p.id,
        label: p.title,
        type: p.typeWord,
        paperKind: p.kind,
        updated: p.updated_at,
      })),
      ...files.map((f) => ({
        kind: "file" as const,
        id: f.id,
        label: f.filename,
        type: "Uploaded",
        updated: f.created_at,
      })),
    ]),
    filter,
  );
  const empty = papers.length === 0 && files.length === 0;
  const filteredEmpty = !empty && rows.length === 0;
  const showFilter = !empty && !gallery;

  return (
    <div>
      <Band
        title="Paper"
        primary={<Button onClick={() => setGallery("cv")}>Start a CV</Button>}
        secondary={
          <>
            <Button variant="ghost" onClick={() => setGallery("letter")}>
              Start a letter
            </Button>
            <label className="relative inline-flex min-h-[var(--size-touch)] cursor-pointer items-center overflow-hidden rounded-[var(--radius-control)] px-4 text-[13px] font-[510] hover:bg-surface-2">
              I already have a file
              <input
                type="file"
                className="absolute inset-0 cursor-pointer opacity-0"
                aria-label="I already have a file"
                accept=".pdf,.doc,.docx,application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onUpload(file);
                }}
              />
            </label>
          </>
        }
        filter={
          showFilter ? (
            <BandFilter
              value={filter}
              onChange={(id) => {
                setGallery(null);
                setFilter(id as PaperListFilter);
              }}
              options={[
                { id: "all", label: "All" },
                { id: "cv", label: "CV / Resume" },
                { id: "letter", label: "Letter" },
                { id: "uploaded", label: "Uploaded" },
              ]}
            />
          ) : undefined
        }
      />

      {gallery ? (
        <SituationGallery
          kind={gallery}
          onPick={(id) => {
            if (gallery === "cv") void createCv(id);
            else void createLetter(id);
          }}
          onCancel={() => setGallery(null)}
        />
      ) : q.isPending ? (
        <SkeletonRows columns />
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
      ) : empty ? (
        <EmptyState
          kind="first-run"
          title="Start with the CV."
          action={
            <Button variant="ghost" onClick={() => setGallery("cv")}>
              Start a CV
            </Button>
          }
        />
      ) : filteredEmpty ? (
        <EmptyState
          kind="filtered"
          title="Nothing in this filter."
          action={
            <Button variant="outline" onClick={() => setFilter("all")}>
              Show all
            </Button>
          }
        />
      ) : (
        <RowList bleed>
          <RowListHeader />
          {rows.map((row) =>
            row.kind === "paper" ? (
              <Row
                key={row.id}
                label={row.label}
                type={row.type}
                updated={relativeUpdated(row.updated)}
                onSelect={() => void navigate({ to: "/paper/$paperId", params: { paperId: row.id } })}
                menu={
                  <RowMenu label={row.label}>
                    <DropdownMenuItem
                      onSelect={() =>
                        void navigate({ to: "/paper/$paperId", params: { paperId: row.id } })
                      }
                    >
                      Open
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() =>
                        void runCommand<{ id: string }>("paper.duplicate", { id: row.id }).then((r) =>
                          navigate({ to: "/paper/$paperId", params: { paperId: r.result.id } }),
                        )
                      }
                    >
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onSelect={() => setRemovePaperId(row.id)}
                    >
                      Delete
                    </DropdownMenuItem>
                  </RowMenu>
                }
              />
            ) : (
              <Row
                key={row.id}
                label={row.label}
                type={row.type}
                updated={relativeUpdated(row.updated)}
                href={`/api/files?id=${row.id}`}
                menu={
                  <RowMenu label={row.label}>
                    <DropdownMenuItem onSelect={() => void startFromUpload()}>
                      Start a CV from this
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onSelect={() => setRemoveFileId(row.id)}
                    >
                      Delete
                    </DropdownMenuItem>
                  </RowMenu>
                }
              />
            ),
          )}
        </RowList>
      )}
      {!q.isPending && !q.isError && !empty && !filteredEmpty ? <EndOfList /> : null}

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
      <ConfirmDialog
        open={Boolean(removeFileId)}
        onOpenChange={(open) => !open && setRemoveFileId(null)}
        title="Delete this file?"
        body="This removes the upload. It cannot be undone."
        confirmLabel="Delete file"
        onConfirm={() => {
          if (!removeFileId) return;
          void runCommand("paper.removeFile", { id: removeFileId }).then(() => q.refetch());
          setRemoveFileId(null);
        }}
      />
    </div>
  );
}

function RowMenu({ label, children }: { label: string; children: ReactNode }) {
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
