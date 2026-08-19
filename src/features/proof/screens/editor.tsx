import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { getProofFn, interviewFn, arrangeFn } from "@/features/proof/queries";
import { ProofEditorView } from "@/features/proof/components/proof-editor-view";
import { runCommand } from "@/ui/run-command";
import { Button } from "@/ui/button";
import { useState } from "react";

export function ProofEditorScreen({ proofId }: { proofId: string }) {
  const q = useQuery({
    queryKey: ["proof", proofId],
    queryFn: () => getProofFn({ data: { id: proofId } }),
  });
  const [note, setNote] = useState("");
  const [question, setQuestion] = useState("");
  const back = (
    <Link to="/proof" className="inline-flex min-h-[var(--size-touch)] items-center text-[13px] text-ink-muted">
      Back
    </Link>
  );
  const proof = q.data;
  const draft = (proof?.page_draft as { what?: string; did?: string; came?: string } | null) ?? null;
  const arranged = Boolean(draft?.what && draft?.did && draft?.came);
  const missingPart = !draft?.what
    ? "what it was"
    : !draft?.did
      ? "what you did"
      : !draft?.came
        ? "what came of it"
        : null;

  return (
    <ProofEditorView
      pending={q.isPending}
      error={q.isError}
      onRetry={() => void q.refetch()}
      missing={!q.isPending && !q.isError && !proof}
      title={proof?.title}
      onTitle={(title) => void runCommand("proof.updateMeta", { id: proofId, title })}
      back={back}
      meta={
        proof
          ? missingPart
            ? `The story still needs ${missingPart}.`
            : arranged
              ? "The story is arranged."
              : undefined
          : undefined
      }
      primary={
        proof ? (
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
        ) : undefined
      }
      note={note}
      onNote={setNote}
      onLog={() => {
        if (!note.trim()) return;
        void runCommand("proof.log", { proofId, body: note }).then(() => {
          setNote("");
          q.refetch();
        });
      }}
      entries={proof?.entries ?? []}
      question={question}
      onAsk={async () => {
        const next = await interviewFn({ data: { id: proofId } });
        setQuestion(next);
      }}
      draft={draft}
      slug={proof?.slug ?? null}
    />
  );
}
