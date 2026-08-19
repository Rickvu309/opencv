import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { listApplicationsFn } from "@/features/application/queries";
import { ApplyView, type ApplyStatus } from "@/features/application/components/apply-view";
import { runCommand } from "@/ui/run-command";

export function ApplicationsScreen() {
  const q = useQuery({ queryKey: ["applications"], queryFn: () => listApplicationsFn() });
  const navigate = useNavigate();

  return (
    <ApplyView
      pending={q.isPending}
      error={q.isError}
      onRetry={() => void q.refetch()}
      rows={q.data ?? []}
      onStatus={(id, status: ApplyStatus) =>
        void runCommand("application.setStatus", { id, status }).then(() => q.refetch())
      }
      onOpenCv={(paperId) => void navigate({ to: "/paper/$paperId", params: { paperId } })}
      onTailor={(id, paperId) =>
        void runCommand("application.tailorCv", { id, paperId }).then(() => q.refetch())
      }
      onSearch={() => void navigate({ to: "/search" })}
    />
  );
}
