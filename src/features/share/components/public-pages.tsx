import { useState } from "react";
import { EmptyState, NotFoundState, QueryError } from "@/ui/empty-state";
import { SkeletonSection } from "@/ui/skeleton";
import { Row, RowList } from "@/ui/rows";
import { Button } from "@/ui/button";

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
  href,
}: {
  pending?: boolean;
  error?: boolean;
  onRetry?: () => void;
  missing?: boolean;
  content?: {
    words?: string;
    date?: string;
    title?: string;
    what?: string;
    did?: string;
    came?: string;
    role?: string;
  };
  href?: string;
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
    <ProofCard content={content} href={href} />
  );
}

function formatProofDate(value: string) {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!iso) return value;
  const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function ProofCard({
  content,
  href,
}: {
  content: {
    words?: string;
    date?: string;
    title?: string;
    what?: string;
    did?: string;
    came?: string;
    role?: string;
  };
  href?: string;
}) {
  const [copied, setCopied] = useState(false);
  const title = content.title && content.title !== "Untitled Proof" ? content.title : null;
  const link = href ?? (typeof window !== "undefined" ? window.location.href : "");

  async function copyLink() {
    if (!link) return;
    const absolute =
      link.startsWith("http") || typeof window === "undefined"
        ? link
        : new URL(link, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(absolute);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main id="main" className="mx-auto max-w-xl px-4 py-16">
      {content.date ? (
        <p className="text-[13px] text-ink-muted tabular-nums">{formatProofDate(content.date)}</p>
      ) : null}
      {title ? (
        <h1 className="mt-2 text-balance text-[24px] font-[590] leading-[1.3] tracking-[-0.017em]">
          {title}
        </h1>
      ) : null}
      {content.role ? <p className="mt-1 text-[13px] text-ink-muted">{content.role}</p> : null}
      {content.words ? (
        title ? (
          <p className="mt-8 whitespace-pre-wrap text-[15px] leading-[1.6]">{content.words}</p>
        ) : (
          <h1 className="mt-3 whitespace-pre-wrap text-[15px] font-[510] leading-[1.6]">{content.words}</h1>
        )
      ) : null}
      {content.what || content.did || content.came ? (
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
      ) : null}
      {link ? (
        <div className="mt-10">
          <Button type="button" variant="outline" onClick={() => void copyLink()}>
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
      ) : null}
    </main>
  );
}
