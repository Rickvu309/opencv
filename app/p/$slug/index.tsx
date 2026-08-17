import { createFileRoute, notFound } from "@tanstack/react-router";

import { ProofArticle } from "@/components/paper/proof-article";
import { loadPublicProof } from "@/lib/paper/public";
import { queryKeys } from "@/lib/query/satellite";

export const Route = createFileRoute("/p/$slug/")({
  loader: async ({ params, context }) => {
    const data = await context.queryClient.ensureQueryData({
      queryKey: queryKeys.proof(params.slug),
      queryFn: () => loadPublicProof({ data: params.slug }),
    });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    const title = loaderData?.snapshot.title || "Proof";
    const description =
      loaderData?.snapshot.why ||
      loaderData?.snapshot.role ||
      loaderData?.snapshot.notes[0]?.text.slice(0, 160);
    const slug = loaderData?.slug;
    return {
      meta: [
        { title },
        ...(description ? [{ name: "description", content: description }] : []),
        { property: "og:title", content: title },
        ...(description
          ? [{ property: "og:description", content: description }]
          : []),
        ...(slug ? [{ property: "og:image", content: `/p/${slug}/og` }] : []),
      ],
    };
  },
  component: ProofSharePage,
});

function ProofSharePage() {
  const { snapshot, slug, siteHandle, otherSpans } = Route.useLoaderData();
  return (
    <main className="min-h-svh bg-[#f3ebe0] text-[#1a1714]">
      <ProofArticle
        snapshot={snapshot}
        slug={slug}
        siteHandle={siteHandle}
        otherSpans={otherSpans}
      />
    </main>
  );
}
