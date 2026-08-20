import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { listPapersFn } from "@/features/paper/queries";
import { DashedA4, PaperCanvasPage } from "@/features/paper/components/page";
import { runCommand } from "@/ui/run-command";
import { Band } from "@/ui/band";
import { QueryError } from "@/ui/empty-state";

export function PaperListScreen() {
  const q = useQuery({ queryKey: ["paper-canvas"], queryFn: () => listPapersFn() });
  const navigate = useNavigate();

  async function openCv() {
    const paperId = q.data?.kind === "cv" ? q.data.paperId : null;
    if (paperId) {
      await navigate({ to: "/paper/$paperId", params: { paperId } });
      return;
    }
    const result = await runCommand<{ id: string }>("paper.create", { kind: "cv" });
    await navigate({ to: "/paper/$paperId", params: { paperId: result.result.id } });
  }

  return (
    <div>
      <Band title="Paper" />
      {q.isPending ? (
        <div className="-mx-5 bg-surface-2 px-5 py-8" aria-busy="true" aria-label="Loading">
          <div className="a4 a4-dashed mx-auto w-full max-w-[210mm] min-h-[297mm]" />
        </div>
      ) : null}
      {q.isError ? (
        <QueryError onRetry={() => void q.refetch()} />
      ) : null}
      {!q.isPending && !q.isError && q.data?.kind === "dashed" ? (
        <div className="-mx-5 bg-surface-2 px-5 py-8">
          <DashedA4 onOpen={() => void openCv()} />
        </div>
      ) : null}
      {!q.isPending && !q.isError && q.data?.kind === "cv" ? (
        <div className="-mx-5 bg-surface-2 px-5 py-8">
          <PaperCanvasPage
            content={q.data.content}
            lines={q.data.lines}
            onOpen={() => void openCv()}
          />
        </div>
      ) : null}
    </div>
  );
}
