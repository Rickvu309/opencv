/** Public Proof page — one published Proof at /p/:slug. */
import { createFileRoute, notFound } from "@tanstack/react-router";

import { Link } from "@/lib/nav";
import { ProofArticle } from "@/components/paper/proof-article";
import { messages } from "@/lib/i18n/messages";
import { loadPublicProof } from "@/lib/paper/public";
import { queryKeys } from "@/lib/query/satellite";

export const Route = createFileRoute("/_public/p/$slug/")({
  loader: async ({ params, context }) => {
    const data = await context.queryClient.ensureQueryData({
      queryKey: queryKeys.proof(params.slug),
      queryFn: () => loadPublicProof({ data: params.slug }),
    });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    const title = loaderData?.snapshot.title || messages.paper.proof.untitled;
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
    <main className="min-h-svh bg-desk text-foreground">
      <div className="mx-auto max-w-[65ch] px-6 py-10">
        <div className="rounded-xl bg-sheet ring-1 ring-border">
          <ProofArticle
            snapshot={snapshot}
            slug={slug}
            siteHandle={siteHandle}
            otherSpans={otherSpans}
          />
        </div>
        <p className="mt-8 text-sm text-muted-foreground">
          <Link href="/" className="underline underline-offset-4">
            OpenPath
          </Link>
        </p>
      </div>
    </main>
  );
}
