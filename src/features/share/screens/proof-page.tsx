import { useQuery } from "@tanstack/react-query";
import { getProofPageFn } from "@/features/share/queries";

export function ProofPageScreen({ slug }: { slug: string }) {
  const q = useQuery({
    queryKey: ["p", slug],
    queryFn: () => getProofPageFn({ data: { slug } }),
  });
  if (q.isLoading) return <p className="p-8">Loading.</p>;
  if (!q.data) return <p className="p-8">This page isn't published.</p>;
  const c = q.data.content as { title?: string; what?: string; did?: string; came?: string; role?: string };

  return (
    <main className="mx-auto max-w-xl px-4 py-16">
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
