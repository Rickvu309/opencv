import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { listPapersFn } from "@/features/paper/queries";
import { templates, letterSituations } from "@/features/paper/model";
import { runCommand } from "@/ui/run-command";
import { Button } from "@/ui/button";
import { EmptyState } from "@/ui/empty-state";
import { useState } from "react";

export function PaperListScreen() {
  const q = useQuery({ queryKey: ["papers"], queryFn: () => listPapersFn() });
  const navigate = useNavigate();
  const [gallery, setGallery] = useState<"cv" | "letter" | null>(null);
  if (!q.data) return <p>Loading papers.</p>;
  const empty = q.data.papers.length === 0 && q.data.files.length === 0;

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

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[28px] font-medium">Paper</h1>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setGallery("cv")}>New CV</Button>
          <Button variant="outline" onClick={() => setGallery("letter")}>
            New letter
          </Button>
          <label className="inline-flex min-h-11 cursor-pointer items-center rounded-[var(--radius-control)] border border-border px-4 text-[14px]">
            Upload
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
        </div>
      </div>
      {empty ? (
        <EmptyState
          title="Start with the CV."
          action={<Button onClick={() => setGallery("cv")}>Build a CV</Button>}
        />
      ) : (
        <ul className="mt-8 divide-y divide-border">
          {q.data.papers.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-3">
              <Link to="/paper/$paperId" params={{ paperId: p.id }}>
                {p.title}
              </Link>
              <span className="text-[14px] text-muted-foreground">{p.typeWord}</span>
            </li>
          ))}
        </ul>
      )}
      {q.data.files.length ? (
        <section className="mt-10">
          <h2 className="text-[18px] font-medium">Uploads</h2>
          <p className="mt-1 text-[14px] text-muted-foreground">
            Preview only. Start a CV from this by writing on a blank page; we do not parse the file.
          </p>
          <ul className="mt-3 space-y-2">
            {q.data.files.map((f) => (
              <li key={f.id}>
                <a className="text-[14px] underline" href={`/api/files?id=${f.id}`}>
                  {f.filename}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {gallery === "cv" ? (
        <div className="mt-8">
          <h2 className="text-[18px] font-medium">Where is this CV going?</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {templates.map((t) => (
              <button
                key={t.id}
                className="rounded-[var(--radius-card)] border border-border p-4 text-left"
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
        <div className="mt-8">
          <h2 className="text-[18px] font-medium">What is this letter for?</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {letterSituations.map((s) => (
              <button
                key={s.id}
                className="rounded-[var(--radius-card)] border border-border p-4 text-left"
                onClick={() => void createLetter(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
