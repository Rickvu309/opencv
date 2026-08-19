import { useQuery } from "@tanstack/react-query";
import { getPersonalPageFn } from "@/features/share/queries";
import { PersonalPageView } from "@/features/share/components/public-pages";

export function PersonalPageScreen({ handle }: { handle: string }) {
  const q = useQuery({
    queryKey: ["u", handle],
    queryFn: () => getPersonalPageFn({ data: { handle } }),
  });
  return (
    <PersonalPageView
      pending={q.isPending}
      error={q.isError}
      onRetry={() => void q.refetch()}
      missing={!q.isPending && !q.isError && !q.data}
      data={
        q.data
          ? {
              name: q.data.name,
              handle: q.data.handle,
              summary: q.data.summary,
              proofs: q.data.proofs,
            }
          : undefined
      }
    />
  );
}
