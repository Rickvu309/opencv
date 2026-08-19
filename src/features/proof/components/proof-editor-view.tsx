import type { ReactNode } from "react";
import { Button } from "@/ui/button";
import { Textarea } from "@/ui/textarea";
import { Label } from "@/ui/label";
import { Band } from "@/ui/band";
import { Card } from "@/ui/card";
import { Section } from "@/ui/section";
import { NotFoundState, QueryError } from "@/ui/empty-state";
import { InfoBlock } from "@/ui/info-block";
import { SkeletonRows } from "@/ui/skeleton";

export type ProofEntry = { id: string; body: string; created_at: string };
export type ProofDraft = { what?: string; did?: string; came?: string } | null;

export function ProofEditorView({
  pending,
  error,
  onRetry,
  missing,
  back,
  meta,
  primary,
  note,
  onNote,
  onLog,
  entries,
  question,
  onSkip,
  draft,
  slug,
}: {
  pending?: boolean;
  error?: boolean;
  onRetry?: () => void;
  missing?: boolean;
  back: ReactNode;
  meta?: string;
  primary?: ReactNode;
  note: string;
  onNote: (value: string) => void;
  onLog: () => void;
  entries: ProofEntry[];
  question: string;
  onSkip?: () => void;
  draft: ProofDraft;
  slug?: string | null;
}) {
  if (pending) {
    return (
      <div>
        <Band title="Proof" back={back} />
        <SkeletonRows />
      </div>
    );
  }
  if (error) {
    return (
      <div>
        <Band title="Proof" back={back} />
        <QueryError onRetry={() => onRetry?.()} />
      </div>
    );
  }
  if (missing) {
    return (
      <div>
        <Band title="Proof" back={back} />
        <NotFoundState
          title="That Proof is not here. Open Proof to see your list."
          href="/proof"
          label="Back to Proof"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Band title="Proof" back={back} meta={meta} primary={primary} />
      <Card>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onLog();
          }}
        >
          <Label htmlFor="proof-log">What happened</Label>
          <Textarea
            id="proof-log"
            value={note}
            onChange={(e) => onNote(e.target.value)}
            placeholder="A café shift counts. Write it like a text."
          />
          <div className="mt-3 flex justify-end">
            <Button type="submit" disabled={!note.trim()}>
              Log
            </Button>
          </div>
        </form>
      </Card>
      {entries.length > 0 ? (
        <ol className="mt-8 divide-y divide-hairline">
          {entries.map((e) => (
            <li key={e.id} className="py-3">
              <p className="text-[15px] leading-[1.6]">{e.body}</p>
              {e.created_at ? (
                <p className="mt-1 text-[13px] text-ink-muted tabular-nums">
                  {new Date(e.created_at).toLocaleDateString()}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
      {question ? (
        <div className="mt-10">
          <InfoBlock>{question}</InfoBlock>
          <div className="mt-3">
            <Button type="button" variant="outline" onClick={() => onSkip?.()}>
              Skip
            </Button>
          </div>
        </div>
      ) : null}
      {draft?.what || draft?.did || draft?.came ? (
        <div className="mt-8 space-y-6">
          {draft.what ? (
            <Section label="What it was">
              <p className="text-[15px] leading-[1.6]">{draft.what}</p>
            </Section>
          ) : null}
          {draft.did ? (
            <Section label="What you did">
              <p className="text-[15px] leading-[1.6]">{draft.did}</p>
            </Section>
          ) : null}
          {draft.came ? (
            <Section label="What came of it">
              <p className="text-[15px] leading-[1.6]">{draft.came}</p>
            </Section>
          ) : null}
        </div>
      ) : null}
      {slug ? (
        <p className="mt-6 text-[13px] text-ink-muted">
          Live at{" "}
          <a href={`/p/${slug}`} className="text-accent underline-offset-2 hover:underline">
            /p/{slug}
          </a>
        </p>
      ) : null}
    </div>
  );
}
