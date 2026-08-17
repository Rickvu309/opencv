import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { listApplicationsFn } from "@/features/application/queries";
import { runCommand } from "@/ui/run-command";
import { Button } from "@/ui/button";
import { Band } from "@/ui/band";
import { Row, RowList } from "@/ui/rows";
import { EmptyState } from "@/ui/empty-state";
import { SkeletonRows } from "@/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu";

const statuses = ["interested", "applied", "interviewing", "offer", "rejected"] as const;
const statusLabel: Record<(typeof statuses)[number], string> = {
  interested: "Interested",
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
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

export function ApplicationsScreen() {
  const q = useQuery({ queryKey: ["applications"], queryFn: () => listApplicationsFn() });
  const navigate = useNavigate();
  const rows = q.data ?? [];

  return (
    <div>
      <Band title="Apply" />
      {q.isPending ? <SkeletonRows /> : null}
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
            <section key={status} className="mt-8">
              <h2 className="text-[14px] font-medium text-muted-foreground">
                {statusLabel[status]}
              </h2>
              <RowList>
                {group.map((a) => (
                  <Row
                    key={a.id}
                    label={a.role || "Opening"}
                    meta={`${a.company}${a.nextStep ? ` · ${a.nextStep}` : ""}`}
                    menu={
                      <div className="flex items-center gap-1">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            aria-label={`Status for ${a.role}`}
                            className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] px-3 text-[14px] hover:bg-muted"
                          >
                            {statusLabel[status]}
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
                              className="flex size-11 items-center justify-center rounded-[var(--radius-control)] text-[14px] hover:bg-muted"
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
                    }
                  />
                ))}
              </RowList>
            </section>
          );
        })}
    </div>
  );
}
