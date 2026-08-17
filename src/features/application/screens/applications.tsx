import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { listApplicationsFn } from "@/features/application/queries";
import { runCommand } from "@/ui/run-command";
import { Button } from "@/ui/button";
import { EmptyState } from "@/ui/empty-state";

const columns = ["interested", "applied", "interviewing", "offer", "rejected"] as const;

export function ApplicationsScreen() {
  const q = useQuery({ queryKey: ["applications"], queryFn: () => listApplicationsFn() });
  if (!q.data) return <p>Loading applications.</p>;
  if (q.data.length === 0) {
    return (
      <EmptyState
        title="Nothing in motion yet. Save an opening from Search and work it here."
        action={
          <Link to="/search">
            <Button>Go to Search</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div>
      <h1 className="text-[28px] font-medium">Applications</h1>
      <div className="mt-6 grid gap-4 md:grid-cols-5">
        {columns.map((status) => (
          <section key={status}>
            <h2 className="text-[14px] font-medium capitalize">{status}</h2>
            {q.data
              .filter((a) => a.status === status)
              .map((a) => (
                <article key={a.id} className="mt-3 rounded-[var(--radius-card)] border border-border p-3">
                  <p className="font-medium">{a.role}</p>
                  <p className="text-[14px] text-muted-foreground">{a.company}</p>
                  <p className="mt-2 text-[14px]">{a.nextStep}</p>
                  {a.cv_paper_id ? (
                    <Link className="mt-2 inline-block text-[14px]" to="/paper/$paperId" params={{ paperId: a.cv_paper_id }}>
                      Open CV
                    </Link>
                  ) : a.master_cv_id ? (
                    <Button
                      className="mt-2"
                      variant="outline"
                      onClick={() =>
                        void runCommand("application.tailorCv", {
                          id: a.id,
                          paperId: a.master_cv_id,
                        }).then(() => q.refetch())
                      }
                    >
                      Tailor a copy
                    </Button>
                  ) : null}
                  {status !== "rejected" && status !== "offer" ? (
                    <Button
                      className="mt-2"
                      variant="ghost"
                      onClick={() => {
                        const next = { interested: "applied", applied: "interviewing", interviewing: "offer" }[status];
                        if (next) void runCommand("application.setStatus", { id: a.id, status: next }).then(() => q.refetch());
                      }}
                    >
                      Move forward
                    </Button>
                  ) : null}
                </article>
              ))}
          </section>
        ))}
      </div>
    </div>
  );
}
