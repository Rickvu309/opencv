import { useQuery } from "@tanstack/react-query";
import { getProofPageFn } from "@/features/share/queries";
import { NotFoundState } from "@/ui/empty-state";
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
      <h1 className="text-[28px] font-medium">{c.title}</h1>
      <p className="text-muted-foreground">{c.role}</p>
      <section className="mt-8 space-y-4 leading-[1.6]">
        <p>{c.what}</p>
        <p>{c.did}</p>
        <p>{c.came}</p>
      </section>
    </main>
  );
}
