import { useQuery } from "@tanstack/react-query";
import { getProofPageFn } from "@/features/share/queries";
import { ProofPageView } from "@/features/share/components/public-pages";

export function ProofPageScreen({ slug }: { slug: string }) {
  const q = useQuery({
    queryKey: ["p", slug],
    queryFn: () => getProofPageFn({ data: { slug } }),
  });
  const content = q.data?.content as
    | { title?: string; what?: string; did?: string; came?: string; role?: string }
    | undefined;
  return (
    <ProofPageView
      pending={q.isPending}
      error={q.isError}
      onRetry={() => void q.refetch()}
      missing={!q.isPending && !q.isError && !q.data}
      content={content}
    />
  );
}
