import { createFileRoute } from "@tanstack/react-router";

import { Link } from "@/lib/nav";
import { loadPersonalSite } from "@/lib/paper/public";
import {
  sentenceForSite,
  spansByYear,
  yearRange,
  type ProofSpan,
} from "@/lib/paper/spans";

export const Route = createFileRoute("/u/$handle")({
  loader: ({ params }) => loadPersonalSite({ data: params.handle }),
  head: ({ params }) => ({
    meta: [{ title: params.handle }],
  }),
  component: PersonalLinkPage,
});

function PersonalLinkPage() {
  const { name, spans } = Route.useLoaderData();
  const byYear = spansByYear(spans);

  return (
    <main className="min-h-svh bg-[#f6f1e8] text-[#1a1714]">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight text-pretty">
          {sentenceForSite(name, spans)}
        </h1>

        {spans.length > 0 && (
          <div className="mt-10 space-y-6">
            {[...byYear.entries()].map(([year, yearSpans]) => (
              <YearHairline key={year} year={year} spans={yearSpans} />
            ))}
          </div>
        )}

        {spans.length > 0 && (
          <ol className="mt-14 space-y-8">
            {[...byYear.entries()].map(([year, yearSpans]) => (
              <li key={year}>
                <h2 className="text-xs tabular-nums text-[#6b645c]">{year}</h2>
                <ul className="mt-3 space-y-3">
                  {yearSpans.map((span) => (
                    <li key={span.slug}>
                      <Link
                        href={`/p/${span.slug}`}
                        className="block text-pretty underline-offset-4 hover:underline"
                      >
                        <span className="text-sm text-[#6b645c]">
                          {span.dates || "Published"}
                        </span>
                        <span className="mt-0.5 block text-base font-medium">
                          {span.title || "Untitled Proof"}
                        </span>
                        {span.why && (
                          <span className="mt-1 block max-w-[65ch] text-sm text-[#4a453f]">
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
    </main>
  );
}

function YearHairline({ year, spans }: { year: number; spans: ProofSpan[] }) {
  const range = yearRange(spans);
  if (!range) return null;
  const pad = 2;
  const min = range.start - pad;
  const max = range.end + pad;
  const width = Math.max(1, max - min);

  return (
    <div>
      <p className="text-xs tabular-nums text-[#6b645c]">{year}</p>
      <div className="relative mt-2 h-8">
        <span
          aria-hidden
          className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[#1a1714]/20"
        />
        {spans.map((span) => {
          const left = ((span.start - min) / width) * 100;
          const spanWidth = Math.max(
            span.tick ? 0 : ((span.end - span.start) / width) * 100,
            span.tick ? 0 : 2,
          );
          return (
            <Link
              key={span.slug}
              href={`/p/${span.slug}`}
              title={span.title}
              className="absolute top-1/2 -translate-y-1/2"
              style={{
                left: `${left}%`,
                width: span.tick ? undefined : `${spanWidth}%`,
              }}
            >
              {span.tick ? (
                <span className="block size-1.5 -translate-x-1/2 rounded-full bg-[#1a1714]" />
              ) : (
                <span className="block h-1.5 rounded-full bg-[#1a1714]" />
              )}
              <span className="sr-only">{span.title}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
