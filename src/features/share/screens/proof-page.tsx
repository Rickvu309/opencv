import { useQuery } from "@tanstack/react-query";
import { getProofPageFn } from "@/features/share/queries";
import { NotFoundState, QueryError } from "@/ui/empty-state";
import { SkeletonSection } from "@/ui/skeleton";

export function ProofPageScreen({ slug }: { slug: string }) {
  const q = useQuery({
    queryKey: ["p", slug],
    queryFn: () => getProofPageFn({ data: { slug } }),
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
          title="This Proof isn't published. Open OpenPath to start yours."
          href="/"
          label="Go to OpenPath"
        />
      </main>
    );
  }
  const c = q.data.content as { title?: string; what?: string; did?: string; came?: string; role?: string };

  return (
    <main id="main" className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-balance text-[24px] font-[590] leading-[1.3] tracking-[-0.017em]">
        {c.title}
      </h1>
      <p className="mt-1 text-[13px] text-ink-muted">{c.role}</p>
      <section className="mt-8 space-y-4 text-[15px] leading-[1.6]">
        <p>{c.what}</p>
        <p>{c.did}</p>
        <p>{c.came}</p>
      </section>
    </main>
  );
}
