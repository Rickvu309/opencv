"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n/use-t";

/**
 * Four questions and a box.
 *
 * The questions are the ones this product actually raises, not a generic FAQ:
 * an agent that edits your work invites exactly one worry, and the first answer
 * is about undo. The box exists because the alternative to a report is a user
 * who quietly leaves.
 */
export default function HelpPage() {
  const { t, m } = useT();
  const [text, setText] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const questions = [
    [m.support.q1, m.support.a1],
    [m.support.q2, m.support.a2],
    [m.support.q3, m.support.a3],
    [m.support.q4, m.support.a4],
  ] as const;

  const send = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (!response.ok) throw new Error("failed");
      setSent(true);
      setText("");
    } catch {
      // Never a false confirmation: a report that did not land must not look
      // like one that did, or the user waits for a reply that is not coming.
      toast.error(t(m.support.reportFailed));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">{t(m.support.title)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t(m.support.lead)}</p>
      </header>

      <dl className="mt-6 space-y-3">
        {questions.map(([question, answer]) => (
          <div key={question.en} className="rounded-xl border bg-card p-4">
            <dt className="text-sm font-medium">{t(question)}</dt>
            <dd className="mt-1 text-sm text-muted-foreground">{t(answer)}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-8">
        <h2 className="text-base font-semibold tracking-tight">
          {t(m.support.reportTitle)}
        </h2>
        {sent ? (
          <p className="mt-3 rounded-xl border bg-card p-4 text-sm text-muted-foreground">
            {t(m.support.reportThanks)}
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            <Textarea
              value={text}
              rows={4}
              placeholder={t(m.support.reportPlaceholder)}
              aria-label={t(m.support.reportTitle)}
              onChange={(event) => setText(event.target.value)}
              className="text-sm"
            />
            <Button size="sm" disabled={busy || text.trim().length < 5} onClick={send}>
              {t(m.support.reportSend)}
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
