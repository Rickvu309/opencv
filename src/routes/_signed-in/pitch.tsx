"use client";

import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCoach } from "@/components/coach/provider";
import { useAppState, useDispatch, useTouched } from "@/lib/actions/store";
import { useT } from "@/lib/i18n/use-t";
import type { Msg } from "@/lib/i18n/locale";
import { answersOf, singletonOf, type PitchItem } from "@/lib/pitch/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_signed-in/pitch")({
  component: PitchPage,
});

/**
 * What the user says about themselves, kept in one place.
 *
 * A workbench for rewriting: write in the box first, then sharpen. Bio and
 * self-introduction share one panel. Interview answers sit below as a list.
 * The Coach is a quiet offer, not the headline.
 */
function PitchPage() {
  const { t, m } = useT();

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-pretty">
          {t(m.pitch.title)}
        </h1>
        <p className="mt-1 text-sm text-pretty text-muted-foreground">{t(m.pitch.lead)}</p>
      </header>

      <div className="@container mt-8">
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="grid divide-y divide-border @min-[36rem]:grid-cols-2 @min-[36rem]:divide-x @min-[36rem]:divide-y-0">
            <Singleton
              kind="bio"
              title={m.pitch.bioTitle}
              lead={m.pitch.bioLead}
              placeholder={m.pitch.bioPlaceholder}
              askPrompt={m.pitch.askCoachBioPrompt}
            />
            <Singleton
              kind="intro"
              title={m.pitch.introTitle}
              lead={m.pitch.introLead}
              placeholder={m.pitch.introPlaceholder}
              askPrompt={m.pitch.askCoachIntroPrompt}
            />
          </div>
        </div>
      </div>

      <AnswerBank />
    </div>
  );
}

/** The bio or the self-introduction: one artefact in the workbench. */
function Singleton({
  kind,
  title,
  lead,
  placeholder,
  askPrompt,
}: {
  kind: "bio" | "intro";
  title: Msg;
  lead: Msg;
  placeholder: Msg;
  askPrompt: Msg;
}) {
  const { pitch } = useAppState();
  const { t, m } = useT();
  const dispatch = useDispatch();
  const touched = useTouched();
  const item = singletonOf(pitch, kind);
  const headingId = React.useId();
  const leadId = React.useId();

  return (
    <article
      className={cn(
        "flex min-w-0 flex-col",
        item && touched.includes(item.id) && "animate-just-changed",
      )}
    >
      <header className="border-b border-border px-4 py-3">
        <h2 id={headingId} className="text-sm font-semibold tracking-tight text-pretty">
          {t(title)}
        </h2>
      </header>

      <div className="px-4 py-3">
        <p id={leadId} className="mb-3 text-xs text-pretty text-muted-foreground">
          {t(lead)}
        </p>
        <BodyBox
          value={item?.body ?? ""}
          placeholder={t(placeholder)}
          labelledBy={headingId}
          describedBy={leadId}
          onCommit={(body) => {
            if (!body) return;
            // `pitch.write` replaces the one of this kind, so editing and
            // first-drafting are the same call and the id survives either way.
            if (item) dispatch("pitch.update", { id: item.id, body }, { silent: true });
            else dispatch("pitch.write", { kind, body });
          }}
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="ms-auto flex flex-wrap items-center gap-1">
            <AskCoach
              label={t(m.pitch.askCoachHelp)}
              prompt={t(askPrompt)}
            />
            {item ? (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t(m.common.delete)}
                className="text-muted-foreground"
                onClick={() => dispatch("pitch.remove", { id: item.id })}
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function AnswerBank() {
  const { pitch } = useAppState();
  const { t, m } = useT();
  const dispatch = useDispatch();
  const answers = answersOf(pitch);
  const touched = useTouched();

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight text-pretty">
            {t(m.pitch.answersTitle)}
          </h2>
          <p className="mt-1 text-sm text-pretty text-muted-foreground">
            {t(m.pitch.answersLead)}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 text-muted-foreground"
          onClick={() =>
            // An empty body, not a placeholder character. An ellipsis looks
            // like content: it survives into the answer bank, gets exported
            // into nothing useful, and the user has to notice and delete it.
            // Empty shows the field's own placeholder instead.
            dispatch("pitch.write", {
              kind: "answer",
              prompt: t(m.pitch.questionPlaceholder),
              body: "",
            })
          }
        >
          <Plus className="size-3.5" aria-hidden="true" />
          {t(m.pitch.addAnswer)}
        </Button>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border bg-card">
        {answers.length === 0 ? (
          <p className="px-4 py-3 text-sm text-pretty text-muted-foreground">
            {t(m.pitch.emptyAnswers)}
          </p>
        ) : (
          <div className="divide-y divide-border">
            {answers.map((answer) => (
              <Answer
                key={answer.id}
                answer={answer}
                flash={touched.includes(answer.id)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Answer({ answer, flash }: { answer: PitchItem; flash: boolean }) {
  const { t, m } = useT();
  const dispatch = useDispatch();

  return (
    <div className={cn("px-4 py-3", flash && "animate-just-changed")}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <CommitInput
            value={answer.prompt ?? ""}
            placeholder={t(m.pitch.questionPlaceholder)}
            ariaLabel={t(m.pitch.questionField)}
            onCommit={(prompt) =>
              dispatch("pitch.update", { id: answer.id, prompt }, { silent: true })
            }
          />
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t(m.pitch.removeAnswer)}
          className="mt-0.5 shrink-0 text-muted-foreground"
          onClick={() => dispatch("pitch.remove", { id: answer.id })}
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
        </Button>
      </div>

      <div className="mt-2">
        <BodyBox
          value={answer.body}
          placeholder={t(m.pitch.answerPlaceholder)}
          label={t(m.pitch.answerField)}
          onCommit={(body) =>
            body && dispatch("pitch.update", { id: answer.id, body }, { silent: true })
          }
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <AskCoach
          label={t(m.pitch.askCoachHelp)}
          prompt={t(m.pitch.askCoachAnswerPrompt(answer.prompt ?? ""))}
        />
      </div>
    </div>
  );
}

/**
 * A textarea that dispatches on blur and accepts what the store hands back.
 *
 * The store can change under it: that is what a Coach draft looks like from
 * here. Compared against the last value this box was given rather than against
 * the draft, so somebody typing is not interrupted by their own keystrokes.
 *
 * Sized to its content. An empty artefact is two lines, not a vacant field.
 */
function BodyBox({
  value,
  placeholder,
  label,
  labelledBy,
  describedBy,
  onCommit,
}: {
  value: string;
  placeholder: string;
  label?: string;
  labelledBy?: string;
  describedBy?: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = React.useState(value);
  const [given, setGiven] = React.useState(value);
  if (value !== given) {
    setGiven(value);
    setDraft(value);
  }

  return (
    <Textarea
      value={draft}
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      placeholder={placeholder}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => draft.trim() !== value && onCommit(draft.trim())}
      rows={2}
      className="min-h-12 resize-none border-0 bg-transparent p-0 text-base leading-6 shadow-none focus-visible:ring-2 focus-visible:ring-ring/50 md:text-sm"
    />
  );
}

function CommitInput({
  value,
  placeholder,
  ariaLabel,
  onCommit,
}: {
  value: string;
  placeholder: string;
  ariaLabel: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = React.useState(value);
  const [given, setGiven] = React.useState(value);
  if (value !== given) {
    setGiven(value);
    setDraft(value);
  }

  return (
    <Input
      value={draft}
      aria-label={ariaLabel}
      placeholder={placeholder}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => draft.trim() !== value && onCommit(draft.trim())}
      className="h-8 min-w-0 border-0 bg-transparent px-0 text-base font-medium shadow-none focus-visible:ring-2 focus-visible:ring-ring/50 md:text-sm"
    />
  );
}

/**
 * A modest offer to sharpen what is in the box.
 *
 * Kept as `thread.send` with the artefact's own prompt, so the Coach still
 * writes in the item's language. The control is a trailing text action: writing
 * in the box is the work; this is help if they want it.
 */
function AskCoach({ label, prompt }: { label: string; prompt: string }) {
  const thread = useCoach();

  return (
    <Button
      variant="ghost"
      size="xs"
      className="font-normal text-muted-foreground hover:text-foreground"
      disabled={thread.busy}
      onClick={() => thread.send(prompt)}
    >
      {label}
    </Button>
  );
}
