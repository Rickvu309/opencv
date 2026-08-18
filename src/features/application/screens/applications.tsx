import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { listApplicationsFn } from "@/features/application/queries";
import { runCommand } from "@/ui/run-command";
import { Button } from "@/ui/button";
import { Band } from "@/ui/band";
import { Chip } from "@/ui/chip";
import { EndOfList } from "@/ui/card";
import { EmptyState, QueryError } from "@/ui/empty-state";
import { SkeletonRows } from "@/ui/skeleton";
import { DataTable, createColumnHelper } from "@/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu";

const statuses = ["interested", "applied", "interviewing", "offer", "rejected"] as const;
const statusDot: Record<(typeof statuses)[number], string> = {
  interested: "bg-status-attention",
  applied: "bg-status-progress",
  interviewing: "bg-status-progress",
  offer: "bg-status-positive",
  rejected: "bg-ink-muted",
};
const statusLabel: Record<(typeof statuses)[number], string> = {
  interested: "Interested",
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
};

type AppRow = {
  id: string;
  role: string;
  company: string;
  status: string;
  nextStep: string;
  cv_paper_id: string | null;
  master_cv_id: string | null;
};

function allowedStatuses(current: string) {
  const forward: Record<string, string> = {
    interested: "applied",
    applied: "interviewing",
    interviewing: "offer",
  };
  return statuses.filter((s) => {
    if (s === current) return true;
    if (s === "rejected") return true;
    const currentIndex = statuses.indexOf(current as (typeof statuses)[number]);
    const nextIndex = statuses.indexOf(s);
    if (nextIndex < currentIndex) return true;
    return forward[current] === s;
  });
}

function chipStatus(status: string): "positive" | "attention" | "muted" | "progress" {
  if (status === "offer") return "positive";
  if (status === "interested") return "attention";
  if (status === "rejected") return "muted";
  return "progress";
}

const helper = createColumnHelper<AppRow>();

export function ApplicationsScreen() {
  const q = useQuery({ queryKey: ["applications"], queryFn: () => listApplicationsFn() });
  const navigate = useNavigate();
  const rows = (q.data ?? []) as AppRow[];

  const columns = [
    helper.accessor("role", {
      header: "Role",
      cell: (ctx) => ctx.getValue() || "Opening",
    }),
    helper.accessor("company", { header: "Company" }),
    helper.accessor("nextStep", {
      header: "Next",
      cell: (ctx) => ctx.getValue() || "—",
    }),
    helper.display({
      id: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status as (typeof statuses)[number];
        return (
          <Chip tone="status" status={chipStatus(status)}>
            {statusLabel[status] ?? status}
          </Chip>
        );
      },
    }),
    helper.display({
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const a = row.original;
        const status = a.status as (typeof statuses)[number];
        return (
          <div className="flex items-center justify-end gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={`Status for ${a.role}`}
                className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-pill)] border border-hairline px-3 text-[13px] hover:bg-surface-2"
              >
                <span className={`size-1.5 rounded-full ${statusDot[status]}`} aria-hidden="true" />
                {statusLabel[status] ?? a.status}
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {allowedStatuses(a.status).map((s) => (
                  <DropdownMenuItem
                    key={s}
                    onSelect={() =>
                      void runCommand("application.setStatus", {
                        id: a.id,
                        status: s,
                      }).then(() => q.refetch())
                    }
                  >
                    {statusLabel[s]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {a.cv_paper_id || a.master_cv_id ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={`Actions for ${a.role}`}
                  className="flex size-11 items-center justify-center rounded-[var(--radius-control)] text-[13px] hover:bg-surface-2"
                >
                  ···
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {a.cv_paper_id ? (
                    <DropdownMenuItem
                      onSelect={() =>
                        void navigate({
                          to: "/paper/$paperId",
                          params: { paperId: a.cv_paper_id! },
                        })
                      }
                    >
                      Open CV
                    </DropdownMenuItem>
                  ) : null}
                  {a.master_cv_id ? (
                    <DropdownMenuItem
                      onSelect={() =>
                        void runCommand("application.tailorCv", {
                          id: a.id,
                          paperId: a.master_cv_id,
                        }).then(() => q.refetch())
                      }
                    >
                      Tailor a copy
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        );
      },
    }),
  ];

  return (
    <div>
      <Band title="Apply" />
      {q.isPending ? <SkeletonRows /> : null}
      {q.isError ? <QueryError onRetry={() => void q.refetch()} /> : null}
      {!q.isPending && rows.length === 0 ? (
        <EmptyState
          kind="first-run"
          title="Nothing in motion yet. Save an opening from Search and work it here."
          action={
            <Button onClick={() => void navigate({ to: "/search" })}>Go to Search</Button>
          }
        />
      ) : null}
      {!q.isPending &&
        statuses.map((status) => {
          const group = rows.filter((a) => a.status === status);
          if (!group.length) return null;
          return (
            <section key={status} className="mt-4">
              <h2 className="-mx-5 bg-surface-2 px-5 py-2 text-[13px] font-[510] text-ink-muted tabular-nums">
                {statusLabel[status]} · {group.length}
              </h2>
              <DataTable columns={columns} data={group} />
            </section>
          );
        })}
      {!q.isPending && !q.isError && rows.length > 0 ? <EndOfList /> : null}
    </div>
  );
}
