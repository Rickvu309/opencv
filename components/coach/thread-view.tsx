"use client";

import * as React from "react";
import { Ban, Check, Loader2, Megaphone, TriangleAlert } from "lucide-react";

import { type EveMessageInputRequest } from "eve/react";

import { Button } from "@/components/ui/button";
import { TypingDots } from "@/components/ui/spinner";
import { lookupAction } from "@/lib/actions/registry";
import { useAppState } from "@/lib/actions/store";
import { cn } from "@/lib/utils";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import {
  type CoachReasoning,
  type CoachToolCall,
} from "@/lib/coach/messages";
import { CatMascot } from "./cat-mascot";
import { CoachProse } from "./prose";
import { ResumeArtifact, type ResumeEdit } from "./resume-artifact";
import { coachStarters } from "@/lib/coach/starters";
import { useT } from "@/lib/i18n/use-t";
import { type CoachThread } from "./thread";

/**
 * The Coach's working, shown while it works.
 *
 * `enable_thinking` is on because it is the only way this model calls tools,
 * and it costs upwards of fifty seconds on an ordinary question. All of that
 * used to be blank: the reasoning streamed the whole time and was filtered out
 * one line above where it would have been rendered.
 *
 * Showing it is also the house style rather than a concession. `instructions.md`
 * opens with "bằng chứng trước lời khuyên" — evidence before advice — and a
 * coach that shows its working is that rule made visible.
 *
 * Auto-opens while streaming and folds itself away a second after, so a settled
 * conversation is prose again and the working is one click back.
 */
function CoachReasoningPanel({
  reasoning,
  compact,
}: {
  reasoning: CoachReasoning;
  compact?: boolean;
}) {
  const { t, m } = useT();

  return (
    <Reasoning
      className="mb-0"
      isStreaming={reasoning.streaming}
      // A finished turn's reasoning stays folded: the answer is the point, and
      // this is the audit trail behind it.
      defaultOpen={reasoning.streaming}
    >
      <ReasoningTrigger
        className={compact ? "text-xs" : "text-sm"}
        getThinkingMessage={(streaming, duration) => (
          <span className={streaming ? "animate-pulse" : undefined}>
            {streaming
              ? t(m.coach.thinking)
              : duration
                ? t(m.coach.thoughtFor(duration))
                : t(m.coach.thoughtBriefly)}
          </span>
        )}
      />
      <ReasoningContent>{reasoning.text}</ReasoningContent>
    </Reasoning>
  );
}

/**
 * What the Coach did, as it does it.
 *
 * Built from `apply_action`'s own part state, so it appears if and only if a
 * call really happened, and it says what really happened to it. The model has
 * been measured writing "Tôi đã thêm việc đó vào danh sách" having called
 * nothing; prose is not evidence, and this is not built from prose.
 */
function CoachToolCalls({ calls }: { calls: CoachToolCall[] }) {
  const { t, m, locale } = useT();

  // A call parked on the user renders as nothing here: the approval card is
  // already on screen saying what is about to happen, and a second chip under
  // it claiming the change is in progress would contradict it.
  const visible = calls.filter((call) => call.state !== "awaiting");
  if (visible.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {visible.map((call) => {
        const label =
          call.state === "done" && call.summary
            ? call.summary[locale]
            : call.state === "running"
              ? t(m.coach.toolRunning)
              : call.state === "denied"
                ? t(m.coach.toolDenied)
                : t(m.coach.toolFailed);

        return (
          <div
            key={call.id}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs",
              call.state === "error"
                ? "border-destructive/30 bg-destructive/5 text-destructive"
                : "bg-muted/40 text-muted-foreground",
            )}
          >
            {call.state === "running" ? (
              <Loader2 className="size-3.5 shrink-0 animate-spin" />
            ) : call.state === "done" ? (
              <Check className="size-3.5 shrink-0 text-foreground" />
            ) : call.state === "denied" ? (
              <Ban className="size-3.5 shrink-0" />
            ) : (
              <TriangleAlert className="size-3.5 shrink-0" />
            )}
            <span className="min-w-0 flex-1">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function CoachMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground",
        className,
      )}
    >
      <Megaphone className="size-3.5" />
    </span>
  );
}

/**
 * A question the Coach parked the turn on.
 *
 * eve suspends the turn durably until this is answered, so the buttons resume
 * a live conversation rather than starting a new one. Rendered as coach prose
 * with choices, not as a form: it is the Coach talking.
 *
 * `allowFreeform` requests are answerable from the composer too, so the copy
 * says so rather than trapping the user in the options.
 */
function QuestionCard({
  question,
  onRespond,
  disabled,
  pendingAction,
  onStartNew,
}: {
  question: EveMessageInputRequest;
  onRespond: (requestId: string, optionId: string) => void;
  disabled: boolean;
  /** The action this approval is gating, when it is one. */
  pendingAction?: string;
  /** Opens a fresh conversation, the only way past a spent session. */
  onStartNew: () => void;
}) {
  const { t, m, locale } = useT();
  // A request to delete something is not a question, and must not read like
  // one. eve marks it `tool-approval`; everything the Coach asks in the normal
  // run of a conversation is `question`, and those stay plain prose with
  // choices under them. This one gets a frame, so it is not answered by
  // reflex on the way past.
  const isApproval = question.kind === "tool-approval";

  // The conversation has spent its budget. `agent.ts` caps a session at 120k
  // input tokens and 12k output, and every turn carries the user's whole state,
  // so a long thread does eventually arrive here.
  //
  // Worth its own treatment because the remedy is a thing the product only just
  // gained: starting another conversation used to mean losing this one, so
  // hitting the cap was a dead end you could only escape by throwing away the
  // thread that got you there. Conversations are kept now, so the way out is
  // real and this can offer it.
  const isLimit = question.kind === "session-limit";

  // eve writes "Approve tool call: apply_action", which names an internal tool
  // and says nothing about what is about to be destroyed. It exposes no hook
  // for replacing that, so the registry's own `confirm` line is used instead
  // and eve's prompt is only the fallback.
  const confirmCopy =
    isApproval && pendingAction
      ? lookupAction(pendingAction)?.confirm?.({} as never)
      : undefined;
  const prompt = confirmCopy ? confirmCopy[locale] : question.prompt;

  return (
    <div
      className={cn(
        "space-y-3",
        isApproval && "rounded-xl border border-destructive/30 bg-destructive/5 p-3.5",
        isLimit && "rounded-xl border bg-muted/40 p-3.5",
      )}
    >
      {isApproval && (
        <p className="flex items-center gap-2 text-xs font-medium text-destructive">
          <TriangleAlert className="size-3.5 shrink-0" />
          {t(m.coach.approvalTitle)}
        </p>
      )}
      {isLimit && (
        <p className="flex items-center gap-2 text-xs font-medium">
          <TriangleAlert className="size-3.5 shrink-0" />
          {t(m.coach.limitTitle)}
        </p>
      )}
      <CoachProse content={isLimit ? t(m.coach.limitBody) : prompt} />
      {isLimit && (
        <Button size="sm" onClick={onStartNew}>
          {t(m.coach.startNewChat)}
        </Button>
      )}
      {question.options && question.options.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {question.options.map((option) => (
            <Button
              key={option.id}
              size="sm"
              variant={
                option.style === "danger"
                  ? "destructive"
                  : option.style === "primary"
                    ? "default"
                    : "outline"
              }
              disabled={disabled}
              onClick={() => onRespond(question.requestId, option.id)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      )}
      {question.allowFreeform && !isApproval && (
        <p className="text-xs text-muted-foreground">
          {t(m.coach.answerInComposer)}
        </p>
      )}
    </div>
  );
}

/**
 * The line above an empty thread, with the sleeping-cat mascot over it.
 *
 * Vietnamese names put the given name last, so the familiar form is the tail
 * rather than the head. Empty until the user has told us, and the greeting drops
 * the name rather than inventing one.
 */
export function CoachGreeting({ compact }: { compact?: boolean }) {
  const { profile } = useAppState();
  const { t, m } = useT();
  const firstName = profile.identity.name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .join(" ");

  return (
    <div
      className={cn(
        "flex flex-col items-center",
        compact ? "gap-1.5" : "gap-2",
      )}
    >
      <CatMascot compact={compact} />
      <p
        className={cn(
          "text-center text-muted-foreground",
          compact ? "text-sm" : "text-[15px]",
        )}
      >
        {firstName ? t(m.coach.readyWithName(firstName)) : t(m.coach.ready)}
      </p>
    </div>
  );
}

/**
 * Four questions worth asking on day one.
 *
 * One panel, hairline-divided, not a wrap of pills. The pills left a leftover
 * chip on the second row and read as tags, not as things you can ask. The
 * house pattern is a bordered container subdivided, so these sit in a 2×2
 * on the page and a stacked list in the 24rem dock, where two columns would
 * clip a Vietnamese line.
 */
export function CoachStarters({
  thread,
  compact,
}: {
  thread: CoachThread;
  compact?: boolean;
}) {
  const { t, m } = useT();
  const state = useAppState();
  const starters = coachStarters(state).map(t);

  return (
    <div
      role="group"
      aria-label={t(m.coach.startersLabel)}
      className="overflow-hidden rounded-xl border bg-card"
    >
      {compact ? (
        <div className="divide-y divide-border">
          {starters.map((prompt) => (
            <StarterRow
              key={prompt}
              prompt={prompt}
              thread={thread}
              compact
            />
          ))}
        </div>
      ) : (
        <div className="divide-y divide-border">
          {[0, 2].map((start) => (
            <div
              key={start}
              className="grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0"
            >
              {starters.slice(start, start + 2).map((prompt) => (
                <StarterRow key={prompt} prompt={prompt} thread={thread} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StarterRow({
  prompt,
  thread,
  compact,
}: {
  prompt: string;
  thread: CoachThread;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={thread.busy}
      onClick={() => thread.send(prompt)}
      className={cn(
        "h-full w-full text-left text-muted-foreground outline-none",
        "transition-colors duration-[var(--duration-press)]",
        "hover:bg-muted/40 hover:text-foreground",
        "focus-visible:bg-muted/40 focus-visible:text-foreground focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50",
        "active:translate-y-px disabled:pointer-events-none disabled:opacity-50",
        "motion-reduce:transition-none",
        compact
          ? "min-h-10 px-3 py-2.5 text-xs leading-5"
          : "min-h-10 px-4 py-3 text-sm leading-6",
      )}
    >
      {prompt}
    </button>
  );
}

/**
 * The CV edits a turn actually landed.
 *
 * Only successful calls count. A `resume.*` call that failed or was refused
 * changed nothing, and showing the document under it would read as though it
 * had.
 */
function resumeEdits(calls: CoachToolCall[] | undefined): ResumeEdit[] {
  return (calls ?? [])
    .filter((c) => c.state === "done" && c.action?.startsWith("resume."))
    .map((c) => ({ action: c.action, input: c.input }));
}

export function CoachMessages({
  thread,
  compact,
  visible = true,
}: {
  thread: CoachThread;
  compact?: boolean;
  /** False while the floating panel is closed; see the scroll effect below. */
  visible?: boolean;
}) {
  const { messages, isTyping } = thread;
  const { t, m } = useT();
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const settled = React.useRef(false);

  // One scroll rule for both surfaces, which had two: the page jumped on first
  // paint and eased afterwards, the panel always jumped. `visible` is a prop
  // because the panel stays mounted while hidden so minimising cannot lose the
  // conversation, and scrolling a hidden element does nothing, so this has to
  // run again when it opens.
  React.useEffect(() => {
    if (!visible || messages.length === 0) return;
    bottomRef.current?.scrollIntoView({
      behavior: settled.current ? "smooth" : "instant",
      block: "end",
    });
    settled.current = true;
  }, [visible, messages, isTyping]);

  return (
    <div>
      <div className={cn("space-y-8", compact && "space-y-6")}>
        {messages.map((message) =>
          message.role === "user" ? (
            <div key={message.id} className="flex justify-end pl-8">
              <div
                className={cn(
                  "rounded-2xl bg-muted px-4 py-2.5 leading-7",
                  compact ? "text-sm leading-6" : "text-[15px]",
                )}
              >
                {message.content}
              </div>
            </div>
          ) : (
            <div
              key={message.id}
              className={cn("flex gap-4", compact && "gap-3")}
            >
              <CoachMark className={compact ? "size-6" : undefined} />
              <div
                className={cn(
                  "min-w-0 flex-1 space-y-4",
                  compact ? "text-sm leading-6" : "text-[15px] leading-7",
                )}
              >
                {message.reasoning && (
                  <CoachReasoningPanel
                    reasoning={message.reasoning}
                    compact={compact}
                  />
                )}
                <CoachProse content={message.content} />
                {message.tools && <CoachToolCalls calls={message.tools} />}
                {resumeEdits(message.tools).length > 0 && (
                  <ResumeArtifact
                    edits={resumeEdits(message.tools)}
                    compact={compact}
                  />
                )}
                {message.question && (
                  <QuestionCard
                    question={message.question}
                    onRespond={thread.respond}
                    disabled={isTyping}
                    pendingAction={
                      message.tools?.find((c) => c.state === "awaiting")?.action
                    }
                    onStartNew={thread.startNewChat}
                  />
                )}
              </div>
            </div>
          ),
        )}

        {isTyping && (
          <div className={cn("flex gap-4", compact && "gap-3")}>
            <CoachMark className={compact ? "size-6" : undefined} />
            <TypingDots
              className="h-7 text-muted-foreground"
              label={t(m.coach.typing)}
            />
          </div>
        )}
      </div>

      {/* Outside the spaced list: as a child of it, the anchor would inherit
          the gap and leave a message-sized hole under the last reply. */}
      <div ref={bottomRef} />
    </div>
  );
}
