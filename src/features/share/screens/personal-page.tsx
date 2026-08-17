import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { getPersonalPageFn } from "@/features/share/queries";
import { EmptyState, NotFoundState } from "@/ui/empty-state";
import { SkeletonSection } from "@/ui/skeleton";

export function PersonalPageScreen({ handle }: { handle: string }) {
  const q = useQuery({
    queryKey: ["u", handle],
    queryFn: () => getPersonalPageFn({ data: { handle } }),
  });
  if (q.isPending) {
    return (
      <main id="main" className="mx-auto max-w-xl px-4 py-16">
        <SkeletonSection />
      </main>
    );
  }
  if (!q.data) {
    return (
      <main id="main" className="mx-auto max-w-xl px-4 py-16">
        <NotFoundState
          title="This page isn't here. Open OpenPath to start yours."
          href="/"
          label="Go to OpenPath"
        />
      </main>
    );
  }

  return (
    <main id="main" className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-[28px] font-medium">{q.data.name || q.data.handle}</h1>
      <p className="mt-2 text-muted-foreground">{q.data.summary}</p>
      <h2 className="mt-10 text-[18px] font-medium">Work</h2>
      {q.data.proofs.length === 0 ? (
        <EmptyState kind="first-run" title="No published Proof yet." />
      ) : (
        <ul className="mt-4 space-y-3">
          {q.data.proofs.map((p) => (
            <li key={p.slug}>
              <Link to="/p/$slug" params={{ slug: p.slug }}>
                {p.title}
              </Link>
              <span className="ml-2 text-muted-foreground">
                {p.role} {p.date_from}–{p.date_to}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
