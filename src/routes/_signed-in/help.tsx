"use client";

import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n/use-t";
import { useSendSupport } from "@/lib/query/satellite";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_signed-in/help")({
  component: HelpPage,
});

/**
 * Four questions and a box.
 *
 * The questions are the ones this product actually raises, not a generic FAQ:
 * an agent that edits your work invites exactly one worry, and the first answer
 * is about undo. The box exists because the alternative to a report is a user
 * who quietly leaves.
 */
function HelpPage() {
  const { t, m } = useT();
  const report = useSendSupport();
  const [sent, setSent] = React.useState(false);
  const [short, setShort] = React.useState(false);
  const form = useForm({
    defaultValues: { text: "" },
    onSubmit: async ({ value }) => {
      if (value.text.trim().length < 5) {
        setShort(true);
        toast.error(t(m.support.reportTooShort));
        return;
      }
      setShort(false);
      try {
        await report.mutateAsync(value.text);
        setSent(true);
        form.reset();
      } catch {
        toast.error(t(m.support.reportFailed));
      }
    },
  });

  const questions = [
    [m.support.q1, m.support.a1],
    [m.support.q2, m.support.a2],
    [m.support.q3, m.support.a3],
    [m.support.q4, m.support.a4],
  ] as const;

  const send = () => {
    void form.handleSubmit();
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">{t(m.support.title)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t(m.support.lead)}</p>
      </header>

      <dl className="mt-6 space-y-3">
        {questions.map(([question, answer]) => (
          <div key={question} className="rounded-xl border bg-card p-4">
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
            <form.Field name="text">
              {(field) => (
                <Textarea
                  value={field.state.value}
                  rows={4}
                  placeholder={t(m.support.reportPlaceholder)}
                  aria-label={t(m.support.reportTitle)}
                  onChange={(event) => {
                    field.handleChange(event.target.value);
                    if (short) setShort(false);
                  }}
                  aria-invalid={short || undefined}
                  className={cn("text-sm", short && "field-error-shake")}
                />
              )}
            </form.Field>
            <Button size="sm" disabled={report.isPending} onClick={send}>
              {t(m.support.reportSend)}
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
