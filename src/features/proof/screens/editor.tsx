import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { getProofFn, interviewFn } from "@/features/proof/queries";
import { ProofEditorView } from "@/features/proof/components/proof-editor-view";
import { runCommand } from "@/ui/run-command";
import { Button } from "@/ui/button";
import { useEffect, useRef, useState } from "react";

export function ProofEditorScreen({ proofId }: { proofId: string }) {
  const q = useQuery({
    queryKey: ["proof", proofId],
    queryFn: () => getProofFn({ data: { id: proofId } }),
  });
  const [note, setNote] = useState("");
  const [question, setQuestion] = useState("");
  const [skipped, setSkipped] = useState(false);
  const asked = useRef(false);
  const back = (
    <Link to="/proof" className="inline-flex min-h-[var(--size-touch)] items-center text-[13px] text-ink-muted">
      Back
    </Link>
  );
  const proof = q.data;
  const draft = (proof?.page_draft as { what?: string; did?: string; came?: string; skippedQuestion?: boolean } | null) ?? null;
  const canPublish = Boolean(proof?.entries?.some((entry: { body?: string }) => entry.body?.trim()));
  const alreadySkipped = Boolean(draft?.skippedQuestion || skipped);

  useEffect(() => {
    if (!proof?.entries?.length || asked.current || alreadySkipped || question) return;
    if (proof.slug || proof.status === "published") return;
    asked.current = true;
    void interviewFn({ data: { id: proofId } })
      .then((next) => {
        if (next) setQuestion(next);
      })
      .catch(() => undefined);
  }, [proof, proofId, alreadySkipped, question]);

  return (
    <ProofEditorView
      pending={q.isPending}
      error={q.isError}
      onRetry={() => void q.refetch()}
      missing={!q.isPending && !q.isError && !proof}
      back={back}
      primary={
        proof && canPublish ? (
          <Button
            onClick={async () => {
              const r = await runCommand<{ slug?: string }>("proof.publish", { id: proofId });
              await q.refetch();
              if (r.result.slug) window.location.assign(`/p/${r.result.slug}`);
            }}
          >
            Publish
          </Button>
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
      onSkip={() => {
        setSkipped(true);
        setQuestion("");
        void runCommand("proof.skipQuestion", { id: proofId });
      }}
      draft={draft}
      slug={proof?.slug ?? null}
    />
  );
}
