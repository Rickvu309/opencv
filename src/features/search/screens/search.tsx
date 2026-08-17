import { useQuery } from "@tanstack/react-query";
import { listOpeningsFn } from "@/features/search/queries";
import { runCommand } from "@/ui/run-command";
import { Button } from "@/ui/button";
import { Textarea } from "@/ui/textarea";
import { EmptyState } from "@/ui/empty-state";
import { useState } from "react";
import { Link } from "@tanstack/react-router";

export function SearchScreen() {
  const q = useQuery({ queryKey: ["openings"], queryFn: () => listOpeningsFn() });
  const [raw, setRaw] = useState("");
  if (!q.data) return <p>Loading openings.</p>;

  if (q.data.thin) {
    return (
      <EmptyState
        title="Fit needs something to read. Add a fact or set a goal first."
        action={
          <Link to="/profile">
            <Button>Open profile</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div>
      <h1 className="text-[28px] font-medium">Search</h1>
      <form
        className="mt-6"
        onSubmit={(e) => {
          e.preventDefault();
          void runCommand("opening.add", { rawText: raw }).then(() => {
            setRaw("");
            q.refetch();
          });
        }}
      >
        <Textarea value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="Paste a posting" />
        <Button className="mt-2" type="submit">
          Score this posting
        </Button>
      </form>
      {q.data.openings.length === 0 ? (
        <EmptyState title="Paste a posting you're looking at, and you'll see how you match." />
      ) : (
        <ul className="mt-8 space-y-4">
          {q.data.openings.map(
            (o: {
              id: string;
              title: string;
              company: string;
              fit: { met: number; total: number; gap: string[] };
            }) => (
              <li key={o.id} className="rounded-[var(--radius-card)] border border-border p-4">
                <p className="font-medium">{o.title}</p>
                <p className="text-muted-foreground">{o.company}</p>
                <p className="mt-2">
                  {o.fit?.met ?? 0} of {o.fit?.total ?? 0}
                  {o.fit?.gap?.length ? ` — missing ${o.fit.gap[0]}` : ""}
                </p>
                <Button
                  className="mt-3"
                  variant="outline"
                  onClick={() =>
                    void runCommand("application.create", { openingId: o.id }).then(() =>
                      q.refetch(),
                    )
                  }
                >
                  Save to applications
                </Button>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
