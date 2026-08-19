import { Band } from "@/ui/band";
import { Button } from "@/ui/button";
import { chipStatusDotClass } from "@/ui/chip";
import { EndOfList } from "@/ui/card";
import { EmptyState, QueryError } from "@/ui/empty-state";
import { GroupHeader, Row, RowList } from "@/ui/rows";
import { SkeletonRows } from "@/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu";

export const applyStatuses = ["interested", "applied", "interviewing", "offer", "rejected"] as const;
export type ApplyStatus = (typeof applyStatuses)[number];

export const applyStatusLabel: Record<ApplyStatus, string> = {
  interested: "Interested",
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
};

export function applyChipStatus(status: string): "positive" | "attention" | "muted" | "progress" {
  if (status === "offer") return "positive";
  if (status === "interested") return "attention";
  if (status === "rejected") return "muted";
  return "progress";
}

export function allowedApplyStatuses(current: string) {
  const forward: Record<string, string> = {
    interested: "applied",
    applied: "interviewing",
    interviewing: "offer",
  };
  return applyStatuses.filter((s) => {
    if (s === current) return true;
    if (s === "rejected") return true;
    const currentIndex = applyStatuses.indexOf(current as ApplyStatus);
    const nextIndex = applyStatuses.indexOf(s);
    if (nextIndex < currentIndex) return true;
    return forward[current] === s;
  });
}

export type ApplyRow = {
  id: string;
  role: string;
  company: string;
  status: string;
  nextStep: string;
  cv_paper_id: string | null;
  master_cv_id: string | null;
};

export function ApplyView({
  pending,
  error,
  onRetry,
  rows,
  onStatus,
  onOpenCv,
  onTailor,
  onSearch,
}: {
  pending?: boolean;
  error?: boolean;
  onRetry?: () => void;
  rows: ApplyRow[];
  onStatus: (id: string, status: ApplyStatus) => void;
  onOpenCv: (paperId: string) => void;
  onTailor: (id: string, paperId: string) => void;
  onSearch: () => void;
}) {
  return (
    <div>
      <Band title="Apply" />
      {pending ? <SkeletonRows /> : null}
      {error ? <QueryError onRetry={() => onRetry?.()} /> : null}
      {!pending && !error && rows.length === 0 ? (
        <EmptyState
          kind="first-run"
          title="Nothing in motion yet. Save an opening from Search and work it here."
          action={<Button onClick={onSearch}>Go to Search</Button>}
        />
      ) : null}
      {!pending &&
        applyStatuses.map((status) => {
          const group = rows.filter((a) => a.status === status);
          if (!group.length) return null;
          return (
            <section key={status} className="mt-4">
              <GroupHeader
                label={applyStatusLabel[status]}
                count={group.length}
                status={applyChipStatus(status)}
              />
              <RowList bleed>
                {group.map((a) => (
                  <Row
                    key={a.id}
                    label={a.role || "Opening"}
                    chip={
                      <StatusMenu
                        role={a.role || "Opening"}
                        status={a.status as ApplyStatus}
                        onStatus={(next) => onStatus(a.id, next)}
                      />
                    }
                    meta={[a.company, a.nextStep].filter(Boolean).join(" · ")}
                    menu={
                      a.cv_paper_id || a.master_cv_id ? (
                        <RowMenu
                          role={a.role || "Opening"}
                          cvId={a.cv_paper_id}
                          masterId={a.master_cv_id}
                          onOpenCv={onOpenCv}
                          onTailor={(paperId) => onTailor(a.id, paperId)}
                        />
                      ) : undefined
                    }
                  />
                ))}
              </RowList>
            </section>
          );
        })}
      {!pending && !error && rows.length > 0 ? <EndOfList /> : null}
    </div>
  );
}

function StatusMenu({
  role,
  status,
  onStatus,
}: {
  role: string;
  status: ApplyStatus;
  onStatus: (status: ApplyStatus) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Status for ${role}`}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-[var(--radius-pill)] border border-hairline px-2.5 text-[13px] leading-[1.5] hover:bg-surface-2 focus-visible:shadow-[var(--focus-ring)]"
      >
        <span className={`size-1.5 rounded-full ${chipStatusDotClass(applyChipStatus(status))}`} aria-hidden="true" />
        {applyStatusLabel[status] ?? status}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {allowedApplyStatuses(status).map((s) => (
          <DropdownMenuItem key={s} onSelect={() => onStatus(s)}>
            {applyStatusLabel[s]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RowMenu({
  role,
  cvId,
  masterId,
  onOpenCv,
  onTailor,
}: {
  role: string;
  cvId: string | null;
  masterId: string | null;
  onOpenCv: (paperId: string) => void;
  onTailor: (paperId: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Actions for ${role}`}
        className="flex size-11 items-center justify-center rounded-[var(--radius-control)] text-[13px] hover:bg-surface-2 focus-visible:shadow-[var(--focus-ring)]"
      >
        ···
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {cvId ? <DropdownMenuItem onSelect={() => onOpenCv(cvId)}>Open CV</DropdownMenuItem> : null}
        {masterId ? (
          <DropdownMenuItem onSelect={() => onTailor(masterId)}>Tailor a copy</DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
