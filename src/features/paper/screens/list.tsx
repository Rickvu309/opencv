import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { listPapersFn } from "@/features/paper/queries";
import { templates, letterSituations } from "@/features/paper/model";
import { runCommand } from "@/ui/run-command";
import { Button } from "@/ui/button";
import { Band, BandFilter } from "@/ui/band";
import { Row, RowList } from "@/ui/rows";
import { EmptyState } from "@/ui/empty-state";
import { SkeletonRows } from "@/ui/skeleton";
import { ConfirmDialog } from "@/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu";
import { useState } from "react";

type Filter = "all" | "cv" | "letter" | "uploaded";

export function PaperListScreen() {
  const q = useQuery({ queryKey: ["papers"], queryFn: () => listPapersFn() });
  const navigate = useNavigate();
  const [gallery, setGallery] = useState<"cv" | "letter" | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
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
  const paperRows = papers
    .filter((p) => filter === "all" || (filter === "cv" && p.kind !== "letter") || (filter === "letter" && p.kind === "letter"))
    .map((p) => ({
      kind: "paper" as const,
      id: p.id,
      label: p.title,
      meta: p.typeWord,
      updated: p.updated_at,
    }));
  const fileRows =
    filter === "letter" || filter === "cv"
      ? []
      : files.map((f) => ({
          kind: "file" as const,
          id: f.id,
          label: f.filename,
          meta: "Uploaded",
          updated: f.created_at,
        }));
  const rows = [...paperRows, ...fileRows];
  const empty = papers.length === 0 && files.length === 0;
  const filteredEmpty = !empty && rows.length === 0;

  return (
    <div>
      <Band
        title="Paper"
        primary={<Button onClick={() => setGallery("cv")}>Start a CV</Button>}
        secondary={
          <>
            <Button variant="outline" onClick={() => setGallery("letter")}>
              Start a letter
            </Button>
            <label className="inline-flex min-h-11 cursor-pointer items-center rounded-[var(--radius-control)] border border-border px-4 text-[14px]">
              I already have a file
              <input
                type="file"
                className="sr-only"
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
          <BandFilter
            value={filter}
            onChange={(id) => {
              setGallery(null);
              setFilter(id as Filter);
            }}
            options={[
              { id: "all", label: "All" },
              { id: "cv", label: "CV / Resume" },
              { id: "letter", label: "Letter" },
              { id: "uploaded", label: "Uploaded" },
            ]}
          />
        }
      />

      {q.isPending ? <SkeletonRows /> : null}

      {gallery === "cv" ? (
        <div>
          <h2 className="text-[18px] font-medium">Where is this CV going?</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {templates.map((t) => (
              <button
                key={t.id}
                className="min-h-11 rounded-[var(--radius-card)] border border-border p-4 text-left"
                onClick={() => void createCv(t.id)}
              >
                <span className="font-medium">{t.label}</span>
                <span className="ml-2 text-muted-foreground">{t.word}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {gallery === "letter" ? (
        <div>
          <h2 className="text-[18px] font-medium">Who is this letter for?</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {letterSituations.map((s) => (
              <button
                key={s.id}
                className="min-h-11 rounded-[var(--radius-card)] border border-border p-4 text-left"
                onClick={() => void createLetter(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {!q.isPending && !gallery && empty ? (
        <EmptyState
          kind="first-run"
          title="Start with the CV."
          action={<Button onClick={() => setGallery("cv")}>Start a CV</Button>}
        />
      ) : null}

      {!q.isPending && !gallery && filteredEmpty ? (
        <EmptyState
          kind="filtered"
          title="Nothing in this filter."
          action={
            <Button variant="outline" onClick={() => setFilter("all")}>
              Show all
            </Button>
          }
        />
      ) : null}

      {!q.isPending && !gallery && rows.length ? (
        <RowList>
          {paperRows.map((p) => (
            <Row
              key={p.id}
              label={p.label}
              meta={p.meta}
              onSelect={() => void navigate({ to: "/paper/$paperId", params: { paperId: p.id } })}
              menu={
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label={`Actions for ${p.label}`}
                    className="flex size-11 items-center justify-center rounded-[var(--radius-control)] text-[14px] hover:bg-muted"
                  >
                    ···
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem
                      onSelect={() =>
                        void navigate({ to: "/paper/$paperId", params: { paperId: p.id } })
                      }
                    >
                      Open
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() =>
                        void runCommand<{ id: string }>("paper.duplicate", { id: p.id }).then((r) =>
                          navigate({ to: "/paper/$paperId", params: { paperId: r.result.id } }),
                        )
                      }
                    >
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onSelect={() => setRemovePaperId(p.id)}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              }
            />
          ))}
          {fileRows.map((f) => (
            <Row
              key={f.id}
              label={f.label}
              meta={f.meta}
              href={`/api/files?id=${f.id}`}
              menu={
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label={`Actions for ${f.label}`}
                    className="flex size-11 items-center justify-center rounded-[var(--radius-control)] text-[14px] hover:bg-muted"
                  >
                    ···
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onSelect={() => void startFromUpload()}>
                      Start a CV from this
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onSelect={() => setRemoveFileId(f.id)}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              }
            />
          ))}
        </RowList>
      ) : null}

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
