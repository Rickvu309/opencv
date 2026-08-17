import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { getProofFn, interviewFn, arrangeFn } from "@/features/proof/queries";
import { runCommand } from "@/ui/run-command";
import { Button } from "@/ui/button";
import { Textarea } from "@/ui/textarea";
import { Input } from "@/ui/input";
import { useState } from "react";

export function ProofEditorScreen({ proofId }: { proofId: string }) {
  const q = useQuery({
    queryKey: ["proof", proofId],
    queryFn: () => getProofFn({ data: { id: proofId } }),
  });
  const [note, setNote] = useState("");
  const [question, setQuestion] = useState("");
  if (!q.data) return <p>Loading this Proof.</p>;
  const proof = q.data;
  const draft = proof.page_draft as { what?: string; did?: string; came?: string } | null;

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/proof" className="text-[14px] text-muted-foreground">
        Back
      </Link>
      <Input
        className="mt-4"
        defaultValue={proof.title}
        onBlur={(e) => void runCommand("proof.updateMeta", { id: proofId, title: e.target.value })}
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
      <ol className="mt-8 space-y-4">
        {proof.entries.map((e: { id: string; body: string; created_at: string }) => (
          <li key={e.id} className="border-l-2 border-border pl-3">
            {e.body}
          </li>
        ))}
      </ol>
      <div className="mt-10 flex flex-wrap gap-3">
        <Button
          variant="outline"
          onClick={async () => {
            const next = await interviewFn({ data: { id: proofId } });
            setQuestion(next);
          }}
        >
          Ask the next question
        </Button>
        <Button
          variant="outline"
          onClick={async () => {
            const story = await arrangeFn({ data: { id: proofId } });
            if (story) await runCommand("proof.arrange", { id: proofId, ...story });
            q.refetch();
          }}
        >
          Arrange
        </Button>
        <Button
          onClick={async () => {
            const r = await runCommand<{ slug?: string }>("proof.publish", { id: proofId });
            q.refetch();
            if (r.result.slug) window.alert(`/p/${r.result.slug}`);
          }}
        >
          Publish
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
