import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { openDump, proofListShowsEndOfList } from "@/features/auth/signed-in-home";
import { listProofsFn } from "@/features/proof/queries";
import { runCommand } from "@/ui/run-command";
import { Button } from "@/ui/button";
import { Band, BandFilter } from "@/ui/band";
import { Chip } from "@/ui/chip";
import { Row, RowList } from "@/ui/rows";
import { EmptyState, QueryError } from "@/ui/empty-state";
import { EndOfList } from "@/ui/card";
import { SkeletonRows } from "@/ui/skeleton";
import { useState } from "react";

function proofChipStatus(status: string): "progress" | "positive" | "attention" | "muted" {
  if (status === "published") return "positive";
  if (status === "arranged") return "progress";
  return "muted";
}

function proofDates(from?: string | null, to?: string | null) {
  if (!from && !to) return "";
  return [from, to].filter(Boolean).join("–");
}

export function ProofListScreen() {
  const q = useQuery({ queryKey: ["proofs"], queryFn: () => listProofsFn() });
  const navigate = useNavigate();
  const [filter, setFilter] = useState("all");
  const items = q.data ?? [];
  const statuses = [...new Set(items.map((p) => p.status).filter(Boolean))];
  const visible = filter === "all" ? items : items.filter((p) => p.status === filter);
  const hasLog = proofListShowsEndOfList(items.map((p) => ({ id: p.id, hasLog: p.has_log })));

  async function logSomething() {
    const dest = await openDump({
      proofs: items.map((p) => ({ id: p.id, hasLog: p.has_log })),
      createDump: async () => {
        const r = await runCommand<{ id: string }>("proof.create", { title: "" });
        return r.result.id;
      },
    });
    await navigate(dest);
  }

  return (
    <div>
      <Band
        title="Proof"
        primary={<Button onClick={() => void logSomething()}>Log something</Button>}
        filter={
          statuses.length > 1 ? (
            <BandFilter
              options={[
                { id: "all", label: "All" },
                ...statuses.map((s) => ({ id: s, label: s })),
              ]}
              value={filter}
              onChange={setFilter}
            />
          ) : undefined
        }
      />
      {q.isPending ? <SkeletonRows /> : null}
      {q.isError ? <QueryError onRetry={() => void q.refetch()} /> : null}
      {!q.isPending && visible.length > 0 ? (
        <RowList bleed>
          {visible.map((p) => (
            <Row
              key={p.id}
              label={p.title || "Proof"}
              chip={
                p.status ? (
                  <Chip tone="status" status={proofChipStatus(p.status)}>
                    {p.status}
                  </Chip>
                ) : undefined
              }
              meta={[p.role || "Logged", proofDates(p.date_from, p.date_to)].filter(Boolean).join(" · ")}
              onSelect={() => void navigate({ to: "/proof/$proofId", params: { proofId: p.id } })}
            />
          ))}
        </RowList>
      ) : null}
      {!q.isPending && !q.isError && items.length > 0 && visible.length === 0 ? (
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
      {!q.isPending && !q.isError && hasLog && visible.length > 0 ? <EndOfList /> : null}
    </div>
  );
}
