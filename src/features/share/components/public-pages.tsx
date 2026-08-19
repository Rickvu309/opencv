import { EmptyState, NotFoundState, QueryError } from "@/ui/empty-state";
import { SkeletonSection } from "@/ui/skeleton";
import { Row, RowList } from "@/ui/rows";

export type PersonalPageData = {
  name: string;
  handle: string;
  summary: string;
  proofs: { slug: string; title: string; role: string; date_from: string; date_to: string }[];
};

export function PersonalPageView({
  pending,
  error,
  onRetry,
  missing,
  data,
}: {
  pending?: boolean;
  error?: boolean;
  onRetry?: () => void;
  missing?: boolean;
  data?: PersonalPageData;
}) {
  if (pending) {
    return (
      <main id="main" className="mx-auto max-w-xl px-4 py-16">
        <SkeletonSection />
      </main>
    );
  }
  if (error) {
    return (
      <main id="main" className="mx-auto max-w-xl px-4 py-16">
        <QueryError onRetry={() => onRetry?.()} />
      </main>
    );
  }
  if (missing || !data) {
    return (
      <main id="main" className="mx-auto max-w-xl px-4 py-16">
        <NotFoundState
          title="This page isn't here. Open OpenPath to start yours."
          href="/"
          label="Go to OpenPath"
        />
      </main>
    );
  }

  return (
    <main id="main" className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-balance text-[24px] font-[590] leading-[1.3] tracking-[-0.017em]">
        {data.name || data.handle}
      </h1>
      <p className="mt-2 text-pretty text-[15px] text-ink-muted">{data.summary}</p>
      <h2 className="mt-10 text-[18px] font-[510] leading-[1.4] tracking-[-0.012em]">Work</h2>
      {data.proofs.length === 0 ? (
        <EmptyState kind="first-run" title="No published Proof yet." />
      ) : (
        <div className="mt-4">
          <RowList>
            {data.proofs.map((p) => (
              <Row
                key={p.slug}
                href={`/p/${p.slug}`}
                label={p.title}
                meta={`${p.role} ${p.date_from}–${p.date_to}`}
              />
            ))}
          </RowList>
        </div>
      )}
    </main>
  );
}

export function ProofPageView({
  pending,
  error,
  onRetry,
  missing,
  content,
}: {
  pending?: boolean;
  error?: boolean;
  onRetry?: () => void;
  missing?: boolean;
  content?: { title?: string; what?: string; did?: string; came?: string; role?: string };
}) {
  if (pending) {
    return (
      <main id="main" className="mx-auto max-w-xl px-4 py-16">
        <SkeletonSection />
      </main>
    );
  }
  if (error) {
    return (
      <main id="main" className="mx-auto max-w-xl px-4 py-16">
        <QueryError onRetry={() => onRetry?.()} />
      </main>
    );
  }
  if (missing || !content) {
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

  return (
    <main id="main" className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-balance text-[24px] font-[590] leading-[1.3] tracking-[-0.017em]">
        {content.title}
      </h1>
      <p className="mt-1 text-[13px] text-ink-muted">{content.role}</p>
      <section className="mt-8 space-y-6 text-[15px] leading-[1.6]">
        {content.what ? (
          <div>
            <h2 className="text-[13px] font-[510] text-ink-muted">What it was</h2>
            <p className="mt-2">{content.what}</p>
          </div>
        ) : null}
        {content.did ? (
          <div>
            <h2 className="text-[13px] font-[510] text-ink-muted">What you did</h2>
            <p className="mt-2">{content.did}</p>
          </div>
        ) : null}
        {content.came ? (
          <div>
            <h2 className="text-[13px] font-[510] text-ink-muted">What came of it</h2>
            <p className="mt-2">{content.came}</p>
          </div>
        ) : null}
      </section>
    </main>
  );
}
