"use client";

import * as React from "react";
import { Plus, Sparkles, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCoach } from "@/components/coach/provider";
import { useAppState, useDispatch, useTouched } from "@/lib/actions/store";
import { localeNames, locales } from "@/lib/i18n/locale";
import type { Msg } from "@/lib/i18n/locale";
import { useT } from "@/lib/i18n/use-t";
import { answersOf, singletonOf, type PitchItem } from "@/lib/pitch/types";
import { cn } from "@/lib/utils";

/**
 * What the user says about themselves, kept in one place.
 *
 * Three surfaces on one screen rather than three screens, because they are the
 * same job seen from three distances: a paragraph for a profile, a minute of
 * speech, and the answers to the questions that follow. Someone preparing for
 * an interview works on all three in one sitting.
 */
export default function PitchPage() {
  const { t, m } = useT();

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">{t(m.pitch.title)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t(m.pitch.lead)}</p>
      </header>

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
      <AnswerBank />
    </div>
  );
}

/** The bio or the self-introduction: one box, or an invitation to fill it. */
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
  const { t, m, locale } = useT();
  const dispatch = useDispatch();
  const item = singletonOf(pitch, kind);

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold tracking-tight">{t(title)}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t(lead)}</p>
        </div>
        {/* The item's own language when it exists, so refining an English
            answer asks in English. Only a first draft falls back to the app's,
            because there is no item yet to take a language from. */}
        <AskCoach
          label={t(kind === "bio" ? m.pitch.askCoachBio : m.pitch.askCoachIntro)}
          prompt={askPrompt[item?.language ?? locale]}
        />
      </div>

      <div className="mt-4 rounded-xl border bg-card p-4">
        <BodyBox
          value={item?.body ?? ""}
          placeholder={t(placeholder)}
          label={t(title)}
          onCommit={(body) => {
            if (!body) return;
            // `pitch.write` replaces the one of this kind, so editing and
            // first-drafting are the same call and the id survives either way.
            if (item) dispatch("pitch.update", { id: item.id, body }, { silent: true });
            else dispatch("pitch.write", { kind, body });
          }}
        />
        {item ? (
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
            <LanguagePicker item={item} />
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t(m.common.delete)}
              className="text-muted-foreground"
              onClick={() => dispatch("pitch.remove", { id: item.id })}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ) : (
          <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
            {t(m.pitch.notWrittenYet)}
          </p>
        )}
      </div>
    </section>
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
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold tracking-tight">
            {t(m.pitch.answersTitle)}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t(m.pitch.answersLead)}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
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
          <Plus className="size-3.5" />
          {t(m.pitch.addAnswer)}
        </Button>
      </div>

      {answers.length === 0 ? (
        <p className="mt-4 rounded-xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          {t(m.pitch.emptyAnswers)}
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {answers.map((answer) => (
            <Answer
              key={answer.id}
              answer={answer}
              flash={touched.includes(answer.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function Answer({ answer, flash }: { answer: PitchItem; flash: boolean }) {
  const { t, m } = useT();
  const dispatch = useDispatch();

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 transition-colors duration-[var(--duration-state)] ease-[var(--ease-enter)] motion-reduce:transition-none",
        flash && "bg-muted",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            {t(m.pitch.questionField)}
          </Label>
          <CommitInput
            value={answer.prompt ?? ""}
            placeholder={t(m.pitch.questionPlaceholder)}
            onCommit={(prompt) =>
              dispatch("pitch.update", { id: answer.id, prompt }, { silent: true })
            }
          />
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t(m.pitch.removeAnswer)}
          className="mt-6 text-muted-foreground"
          onClick={() => dispatch("pitch.remove", { id: answer.id })}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      <div className="mt-3 space-y-1.5">
        <Label className="text-xs text-muted-foreground">{t(m.pitch.answerField)}</Label>
        <BodyBox
          value={answer.body}
          placeholder={t(m.pitch.answerPlaceholder)}
          label={t(m.pitch.answerField)}
          onCommit={(body) =>
            body && dispatch("pitch.update", { id: answer.id, body }, { silent: true })
          }
        />
      </div>

      <div className="mt-3 border-t border-border pt-3">
        <LanguagePicker item={answer} />
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
 */
function BodyBox({
  value,
  placeholder,
  label,
  onCommit,
}: {
  value: string;
  placeholder: string;
  label: string;
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
      aria-label={label}
      placeholder={placeholder}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => draft.trim() !== value && onCommit(draft.trim())}
      rows={Math.max(4, Math.ceil(draft.length / 70) + draft.split("\n").length)}
      className="resize-none border-0 bg-transparent p-0 text-sm leading-6 shadow-none focus-visible:ring-0"
    />
  );
}

function CommitInput({
  value,
  placeholder,
  onCommit,
}: {
  value: string;
  placeholder: string;
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
      placeholder={placeholder}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => draft.trim() !== value && onCommit(draft.trim())}
      className="h-9 text-sm"
    />
  );
}

/** Which language this piece is written in, independent of the interface. */
function LanguagePicker({ item }: { item: PitchItem }) {
  const dispatch = useDispatch();

  return (
    <div className="flex items-center gap-1">
      {locales.map((code) => (
        <Button
          key={code}
          variant={item.language === code ? "secondary" : "ghost"}
          size="sm"
          className={item.language === code ? undefined : "text-muted-foreground"}
          onClick={() =>
            dispatch("pitch.update", { id: item.id, language: code }, { silent: true })
          }
        >
          {localeNames[code]}
        </Button>
      ))}
    </div>
  );
}

/**
 * Hands the Coach the request the user would have typed.
 *
 * The Coach is the way these get written, and making somebody switch to the
 * chat and compose "draft my bio" is friction between them and the feature the
 * page is about.
 */
function AskCoach({ label, prompt }: { label: string; prompt: string }) {
  const thread = useCoach();

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-muted-foreground"
      disabled={thread.busy}
      onClick={() => thread.send(prompt)}
    >
      <Sparkles className="size-3.5" />
      {label}
    </Button>
  );
}
