import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { listProofsFn } from "@/features/proof/queries";
import { runCommand } from "@/ui/run-command";
import { Button } from "@/ui/button";
import { EmptyState } from "@/ui/empty-state";

export function ProofListScreen() {
  const q = useQuery({ queryKey: ["proofs"], queryFn: () => listProofsFn() });
  const navigate = useNavigate();
  if (!q.data) return <p>Loading Proofs.</p>;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] font-medium">Proof</h1>
        <Button
          onClick={async () => {
            const r = await runCommand<{ id: string }>("proof.create", { title: "New Proof" });
            await navigate({ to: "/proof/$proofId", params: { proofId: r.result.id } });
          }}
        >
          New
        </Button>
      </div>
      {q.data.length === 0 ? (
        <EmptyState title="Log what you're making. A class project, a shift, an assignment, something that failed — it all counts." />
      ) : (
        <ul className="mt-8 divide-y divide-border">
          {q.data.map((p) => (
            <li key={p.id} className="py-3">
              <Link to="/proof/$proofId" params={{ proofId: p.id }}>
                {p.title}
              </Link>
              <span className="ml-3 text-[14px] text-muted-foreground">
                {p.role} · {p.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
