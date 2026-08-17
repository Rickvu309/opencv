import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { listProofsFn } from "@/features/proof/queries";
import { runCommand } from "@/ui/run-command";
import { Button } from "@/ui/button";
import { Band } from "@/ui/band";
import { Row, RowList } from "@/ui/rows";
import { EmptyState } from "@/ui/empty-state";
import { SkeletonRows } from "@/ui/skeleton";

export function ProofListScreen() {
  const q = useQuery({ queryKey: ["proofs"], queryFn: () => listProofsFn() });
  const navigate = useNavigate();

  async function logSomething() {
    const r = await runCommand<{ id: string }>("proof.create", { title: "Untitled Proof" });
    await navigate({ to: "/proof/$proofId", params: { proofId: r.result.id } });
  }

  return (
    <div>
      <Band title="Proof" primary={<Button onClick={() => void logSomething()}>Log something</Button>} />
      {q.isPending ? <SkeletonRows /> : null}
      {!q.isPending && (q.data?.length ?? 0) === 0 ? (
        <EmptyState
          kind="first-run"
          title="Log the first thing you're making."
          basis="A class project, a shift, an assignment, something that failed — it all counts."
          action={<Button onClick={() => void logSomething()}>Log something</Button>}
        />
      ) : null}
      {!q.isPending && q.data && q.data.length > 0 ? (
        <RowList>
          {q.data.map((p) => (
            <Row
              key={p.id}
              label={p.title}
              meta={`${p.role || "Logged"} · ${p.status}`}
              onSelect={() => void navigate({ to: "/proof/$proofId", params: { proofId: p.id } })}
            />
          ))}
        </RowList>
      ) : null}
    </div>
  );
}
