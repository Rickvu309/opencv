import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { getProofFn, interviewFn, arrangeFn } from "@/features/proof/queries";
import { runCommand } from "@/ui/run-command";
import { Button } from "@/ui/button";
import { Textarea } from "@/ui/textarea";
import { Input } from "@/ui/input";
import { Band } from "@/ui/band";
import { NotFoundState } from "@/ui/empty-state";
import { SkeletonRows } from "@/ui/skeleton";
import { useState } from "react";

export function ProofEditorScreen({ proofId }: { proofId: string }) {
  const q = useQuery({
    queryKey: ["proof", proofId],
    queryFn: () => getProofFn({ data: { id: proofId } }),
  });
  const [note, setNote] = useState("");
  const [question, setQuestion] = useState("");
  const back = (
    <Link to="/proof" className="inline-flex min-h-11 items-center text-[14px] text-muted-foreground">
      Back
    </Link>
  );
  if (q.isPending) {
    return (
      <div>
        <Band title="Proof" back={back} />
        <SkeletonRows />
      </div>
    );
  }
  if (!q.data) {
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
  const proof = q.data;
  const draft = proof.page_draft as { what?: string; did?: string; came?: string } | null;
  const arranged = Boolean(draft?.what && draft?.did && draft?.came);
  const missingPart = !draft?.what ? "what it was" : !draft?.did ? "what you did" : !draft?.came ? "what came of it" : null;

  return (
    <div className="mx-auto max-w-2xl">
      <Band
        title={
          <h1 className="min-w-0 flex-1">
            <Input
              aria-label="Title"
              defaultValue={proof.title}
              onBlur={(e) => void runCommand("proof.updateMeta", { id: proofId, title: e.target.value })}
            />
          </h1>
        }
        back={back}
        meta={missingPart ? `The story still needs ${missingPart}.` : arranged ? "The story is arranged." : undefined}
        primary={
          arranged ? (
            <Button
              onClick={async () => {
                const r = await runCommand<{ slug?: string }>("proof.publish", { id: proofId });
                await q.refetch();
                if (r.result.slug) window.location.assign(`/p/${r.result.slug}`);
              }}
            >
              Publish
            </Button>
          ) : (
            <Button
              onClick={async () => {
                const story = await arrangeFn({ data: { id: proofId } });
                if (story) await runCommand("proof.arrange", { id: proofId, ...story });
                await q.refetch();
              }}
            >
              Arrange
            </Button>
          )
        }
      />
      <form
        className="mt-6"
        onSubmit={(e) => {
          e.preventDefault();
          void runCommand("proof.log", { proofId, body: note }).then(() => {
            setNote("");
            q.refetch();
          });
        }}
      >
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What happened" />
        <Button className="mt-2" type="submit">
          Log
        </Button>
      </form>
      {proof.entries.length === 0 ? (
        <p className="mt-8 text-muted-foreground">Log the first entry.</p>
      ) : (
        <ol className="mt-8 space-y-4">
          {proof.entries.map((e: { id: string; body: string; created_at: string }) => (
            <li key={e.id} className="border-l-2 border-border pl-3">
              {e.body}
            </li>
          ))}
        </ol>
      )}
      <div className="mt-10">
        <Button
          variant="outline"
          onClick={async () => {
            const next = await interviewFn({ data: { id: proofId } });
            setQuestion(next);
          }}
        >
          Ask the next question
        </Button>
      </div>
      {question ? <p className="mt-4">{question}</p> : null}
      {draft ? (
        <section className="mt-8 space-y-3">
          <p><strong>What it was.</strong> {draft.what}</p>
          <p><strong>What you did.</strong> {draft.did}</p>
          <p><strong>What came of it.</strong> {draft.came}</p>
        </section>
      ) : null}
      {proof.slug ? (
        <p className="mt-6">
          Live at <Link to="/p/$slug" params={{ slug: proof.slug }}>/p/{proof.slug}</Link>
        </p>
      ) : null}
    </div>
  );
}
