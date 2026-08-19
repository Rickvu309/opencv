import { useQuery } from "@tanstack/react-query";
import { getPersonalPageFn } from "@/features/share/queries";
import { EmptyState, NotFoundState, QueryError } from "@/ui/empty-state";
import { SkeletonSection } from "@/ui/skeleton";
import { Row, RowList } from "@/ui/rows";

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
  if (q.isError) {
    return (
      <main id="main" className="mx-auto max-w-xl px-4 py-16">
        <QueryError onRetry={() => void q.refetch()} />
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
      <h2 className="mt-10 text-[18px] font-[510] leading-[1.4] tracking-[-0.012em]">Work</h2>
      {q.data.proofs.length === 0 ? (
        <EmptyState kind="first-run" title="No published Proof yet." />
      ) : (
        <div className="mt-4">
          <RowList>
            {q.data.proofs.map((p) => (
              <Row
                key={p.slug}
                href={`/p/${p.slug}`}
                label={p.title}
                meta={`${p.role} ${p.date_from}–${p.date_to}`}
              />
            ))}
          </RowList>
        </div>
      )}
    </main>
  );
}
