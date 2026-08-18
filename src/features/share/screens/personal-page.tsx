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
      <h1 className="text-balance text-[24px] font-[590] leading-[1.3] tracking-[-0.017em]">
        {q.data.name || q.data.handle}
      </h1>
      <p className="mt-2 text-pretty text-[15px] text-ink-muted">{q.data.summary}</p>
      <h2 className="mt-10 text-[18px] font-[510] tracking-[-0.012em]">Work</h2>
      {q.data.proofs.length === 0 ? (
        <EmptyState kind="first-run" title="No published Proof yet." />
      ) : (
        <ul className="mt-4 divide-y divide-hairline">
          {q.data.proofs.map((p) => (
            <li key={p.slug} className="flex min-h-11 flex-wrap items-baseline justify-between gap-x-3 py-3">
              <Link to="/p/$slug" params={{ slug: p.slug }} className="text-[15px] font-[510]">
                {p.title}
              </Link>
              <span className="text-[13px] text-ink-muted tabular-nums">
                {p.role} {p.date_from}–{p.date_to}
              </span>
            </li>
          ))}
        </ul>
      )}
      <footer className="mt-16 text-[13px] text-ink-muted">
        <a href="/">OpenPath</a>
      </footer>
    </main>
  );
}
