import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { listPapersFn } from "@/features/paper/queries";
import { ProofLines } from "@/features/paper/components/page";
import { runCommand } from "@/ui/run-command";
import { Band } from "@/ui/band";
import { PageCanvas } from "@/ui/page-canvas";
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
        <div className="-mx-5" aria-busy="true" aria-label="Loading">
          <PageCanvas empty />
        </div>
      ) : null}
      {q.isError ? <QueryError onRetry={() => void q.refetch()} /> : null}
      {!q.isPending && !q.isError && q.data?.kind === "dashed" ? (
        <div className="-mx-5">
          <PageCanvas empty label="Open a CV" onOpen={() => void openCv()} />
        </div>
      ) : null}
      {!q.isPending && !q.isError && q.data?.kind === "cv" ? (
        <div className="-mx-5">
          <PageCanvas label="Open this CV" onOpen={() => void openCv()}>
            <ProofLines lines={q.data.lines} />
          </PageCanvas>
        </div>
      ) : null}
    </div>
  );
}
