import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { getPersonalPageFn } from "@/features/share/queries";

export function PersonalPageScreen({ handle }: { handle: string }) {
  const q = useQuery({
    queryKey: ["u", handle],
    queryFn: () => getPersonalPageFn({ data: { handle } }),
  });
  if (q.isLoading) return <p className="p-8">Loading.</p>;
  if (!q.data) return <p className="p-8">This page isn't published.</p>;

  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-[28px] font-medium">{q.data.name || q.data.handle}</h1>
      <p className="mt-2 text-muted-foreground">{q.data.summary}</p>
      <h2 className="mt-10 text-[18px] font-medium">Work</h2>
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
    </main>
  );
}
