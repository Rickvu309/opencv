/** Personal link — published Proofs for a handle at /u/:handle. */
import { createFileRoute } from "@tanstack/react-router";

import { Link } from "@/lib/nav";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { messages } from "@/lib/i18n/messages";
import { loadPersonalSite } from "@/lib/paper/public";
import { sentenceForSite, spansByYear } from "@/lib/paper/spans";

export const Route = createFileRoute("/_public/u/$handle")({
  loader: ({ params }) => loadPersonalSite({ data: params.handle }),
  head: ({ params }) => ({
    meta: [{ title: params.handle }],
  }),
  component: PersonalLinkPage,
});

function PersonalLinkPage() {
  const { name, spans } = Route.useLoaderData();
  const byYear = spansByYear(spans);
  const copy = messages.paper.proof;

  return (
    <main className="min-h-svh bg-desk text-foreground">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <div className="rounded-xl bg-sheet px-6 py-10 ring-1 ring-border">
          <h1 className="text-3xl font-semibold tracking-tight text-pretty">
            {sentenceForSite(name, spans)}
          </h1>

          {spans.length === 0 ? (
            <EmptyState
              className="mt-8 px-0"
              body={copy.emptySite}
              action={
                <Button asChild variant="outline" size="sm">
                  <Link href="/">{copy.emptySiteAction}</Link>
                </Button>
              }
            />
          ) : (
            <ol className="mt-10 space-y-8">
              {[...byYear.entries()].map(([year, yearSpans]) => (
                <li key={year}>
                  <h2 className="text-xs tabular-nums text-muted-foreground">{year}</h2>
                  <ul className="mt-3 divide-y divide-border overflow-hidden rounded-xl border">
                    {yearSpans.map((span) => (
                      <li key={span.slug}>
                        <Link
                          href={`/p/${span.slug}`}
                          className="block px-4 py-3 text-pretty hover:bg-foreground/4"
                        >
                          <span className="text-sm text-muted-foreground">
                            {span.dates || copy.published}
                          </span>
                          <span className="mt-0.5 block text-base font-medium">
                            {span.title || copy.untitled}
                          </span>
                          {span.why && (
                            <span className="mt-1 block max-w-[65ch] text-sm text-foreground">
                              {span.why}
                            </span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
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
