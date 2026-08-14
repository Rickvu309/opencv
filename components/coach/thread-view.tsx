"use client";

import * as React from "react";
import {
  Ban,
  BrainIcon,
  Check,
  ChevronDownIcon,
  Loader2,
  TriangleAlert,
} from "lucide-react";
import { CoachBox, type CoachBoxPose } from "@/components/brand/coach-box";

import { type EveMessageInputRequest } from "eve/react";

import { Button } from "@/components/ui/button";
import { ThinkingOrb } from "./thinking-orb";
import { lookupAction } from "@/lib/actions/registry";
import { useAppState } from "@/lib/actions/store";
import { cn } from "@/lib/utils";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
  useReasoning,
} from "@/components/ai-elements/reasoning";
import {
  type CoachReasoning,
  type CoachToolCall,
} from "@/lib/coach/messages";
import { CoachProse } from "./prose";
import { ResumeArtifact, type ResumeEdit } from "./resume-artifact";
import { useT } from "@/lib/i18n/use-t";
import {
  TextSwap,
  iconSwapIn,
  iconSwapItem,
  iconSwapOut,
} from "./motion";
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
  return (
    <Reasoning
      className="mb-0"
      isStreaming={reasoning.streaming}
      // A finished turn's reasoning stays folded: the answer is the point, and
      // this is the audit trail behind it.
      defaultOpen={reasoning.streaming}
    >
      <CoachThinkingTrigger compact={compact} />
      <ReasoningContent>{reasoning.text}</ReasoningContent>
    </Reasoning>
  );
}

function CoachThinkingTrigger({ compact }: { compact?: boolean }) {
  const { t, m } = useT();
  const { isStreaming, isOpen, duration } = useReasoning();

  return (
    <ReasoningTrigger className={compact ? "text-xs" : "text-sm"}>
      {isStreaming ? (
        <ThinkingOrb className="text-foreground" />
      ) : (
        <BrainIcon className="size-4" />
      )}
      <TextSwap
        text={
          isStreaming
            ? t(m.coach.thinking)
            : duration
              ? t(m.coach.thoughtFor(duration))
              : t(m.coach.thoughtBriefly)
        }
      />
      <ChevronDownIcon
        className={cn(
          "size-4 transition-transform duration-[var(--duration-state)] ease-enter motion-reduce:transition-none",
          isOpen ? "rotate-180" : "rotate-0",
        )}
      />
    </ReasoningTrigger>
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
function toolLabel(
  call: CoachToolCall,
  t: (msg: { vi: string; en: string }) => string,
  m: typeof import("@/lib/i18n/messages").messages.coach,
  locale: "vi" | "en",
) {
  if (call.state === "done" && call.summary) return call.summary[locale];
  if (call.state === "running") return t(m.toolRunning);
  if (call.state === "denied") return t(m.toolDenied);
  return t(m.toolFailed);
}

function ToolChip({
  call,
  label,
}: {
  call: CoachToolCall;
  label: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground",
        call.state === "error" &&
          "border-destructive/30 bg-destructive/5 text-destructive",
      )}
    >
      <span className="relative size-3 shrink-0">
        <Loader2
          className={cn(
            iconSwapItem,
            "animate-spin",
            call.state === "running" ? iconSwapIn : iconSwapOut,
          )}
        />
        <Check
          className={cn(
            iconSwapItem,
            "text-foreground",
            call.state === "running" ? iconSwapOut : iconSwapIn,
          )}
        />
      </span>
      <span className="min-w-0 truncate">{label}</span>
    </div>
  );
}

function CoachToolCalls({ calls }: { calls: CoachToolCall[] }) {
  const { t, m, locale } = useT();
  const [expanded, setExpanded] = React.useState(false);

  // A call parked on the user renders as nothing here: the approval card is
  // already on screen saying what is about to happen, and a second chip under
  // it claiming the change is in progress would contradict it.
  const visible = calls.filter((call) => call.state !== "awaiting");
  if (visible.length === 0) return null;

  const chips = visible.filter(
    (call) => call.state === "running" || call.state === "done",
  );
  const alerts = visible.filter(
    (call) => call.state === "error" || call.state === "denied",
  );
  const done = chips.filter((call) => call.state === "done");
  const running = chips.filter((call) => call.state === "running");
  const collapseDone = done.length > 1 && !expanded;

  return (
    <div className="flex flex-col items-start gap-1.5">
      {running.map((call) => (
        <ToolChip
          key={call.id}
          call={call}
          label={toolLabel(call, t, m.coach, locale)}
        />
      ))}
      {collapseDone ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground outline-none hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Check className="size-3 shrink-0 text-foreground" />
          {t(m.coach.toolChanges(done.length))}
        </button>
      ) : (
        done.map((call) => (
          <ToolChip
            key={call.id}
            call={call}
            label={toolLabel(call, t, m.coach, locale)}
          />
        ))
      )}
      {alerts.map((call) => (
        <div
          key={call.id}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs",
            call.state === "error"
              ? "border-destructive/30 bg-destructive/5 text-destructive"
              : "bg-muted/40 text-muted-foreground",
          )}
        >
          {call.state === "denied" ? (
            <Ban className="size-3.5 shrink-0" />
          ) : (
            <TriangleAlert className="size-3.5 shrink-0" />
          )}
          <span className="min-w-0 flex-1">{toolLabel(call, t, m.coach, locale)}</span>
        </div>
      ))}
    </div>
  );
}

export function CoachMark({
  className,
  pose = "sit",
}: {
  className?: string;
  pose?: "sit" | "listen" | "think" | "done";
}) {
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground",
        className,
      )}
    >
      <CoachBox size="sm" filled pose={pose} />
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
 * Empty-kit extra pose: Sit, one blink, then Listen. Once. Not a loop.
 * Reduced motion stays Sit. The copy already says she is listening.
 */
function useGreetingPose(): CoachBoxPose {
  const [pose, setPose] = React.useState<CoachBoxPose>("sit");

  React.useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const blink = window.setTimeout(() => setPose("done"), 700);
    const listen = window.setTimeout(() => setPose("listen"), 1500);
    return () => {
      window.clearTimeout(blink);
      window.clearTimeout(listen);
    };
  }, []);

  return pose;
}

/**
 * The line above an empty thread, with the box over it.
 *
 * Vietnamese names put the given name last, so the familiar form is the tail
 * rather than the head. Empty until the user has told us, and the greeting drops
 * the name rather than inventing one.
 */
export function CoachGreeting({ compact }: { compact?: boolean }) {
  const state = useAppState();
  const { t, m } = useT();
  const pose = useGreetingPose();
  const firstName = state.profile.identity.name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .join(" ");

  return (
    <div
      className={cn(
        "flex flex-col items-center",
        compact ? "gap-1.5 px-1" : "gap-2 px-4",
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center",
          compact ? "size-6" : "size-12",
        )}
      >
        <CoachBox
          size={compact ? "md" : "lg"}
          pose={pose}
          live={!compact}
          className="text-foreground"
        />
      </span>
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

function scrollPane(from: HTMLElement | null): HTMLElement | null {
  let node = from?.parentElement ?? null;
  while (node) {
    const overflow = getComputedStyle(node).overflowY;
    if (overflow === "auto" || overflow === "scroll") return node;
    node = node.parentElement;
  }
  return null;
}

function nearLiveEdge(pane: HTMLElement) {
  return pane.scrollHeight - pane.scrollTop - pane.clientHeight < 56;
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
  const last = messages[messages.length - 1];
  const reasoningLive =
    last?.role === "assistant" && Boolean(last.reasoning?.streaming);
  const composing =
    last?.role === "assistant" && last.content.trim().length > 0;
  const rootRef = React.useRef<HTMLDivElement>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const settled = React.useRef(false);
  const following = React.useRef(true);
  const [showJump, setShowJump] = React.useState(false);

  React.useEffect(() => {
    const pane = scrollPane(rootRef.current);
    if (!pane) return;
    const onScroll = () => {
      const atEdge = nearLiveEdge(pane);
      following.current = atEdge;
      setShowJump(!atEdge);
    };
    pane.addEventListener("scroll", onScroll, { passive: true });
    return () => pane.removeEventListener("scroll", onScroll);
  }, [visible]);

  // Follow the live edge only while the reader is still there. Scrolling up
  // during a stream must not yank them back.
  React.useEffect(() => {
    if (!visible || messages.length === 0 || !following.current) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    bottomRef.current?.scrollIntoView({
      behavior: settled.current && !reduced ? "smooth" : "instant",
      block: "end",
    });
    settled.current = true;
  }, [visible, messages, isTyping]);

  function jumpToLatest() {
    following.current = true;
    setShowJump(false);
    bottomRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "end",
    });
  }

  return (
    <div ref={rootRef} className="relative">
      <div className={cn("space-y-8", compact && "space-y-6")}>
        {messages.map((message) =>
          message.role === "user" ? (
            <div
              key={message.id}
              className="flex justify-end pl-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-[var(--duration-state)] motion-safe:ease-enter"
            >
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
              className={cn(
                "flex gap-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-[var(--duration-state)] motion-safe:ease-enter",
                compact && "gap-3",
              )}
            >
              <CoachMark
                className={compact ? "size-6" : undefined}
                pose={
                  resumeEdits(message.tools).length > 0 ||
                  message.tools?.some((call) => call.state === "done")
                    ? "done"
                    : "sit"
                }
              />
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

        {isTyping && !reasoningLive && (
          <div
            className={cn(
              "flex items-center gap-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-[var(--duration-state)] motion-safe:ease-enter",
              compact && "gap-3",
            )}
          >
            <CoachMark className={compact ? "size-6" : undefined} />
            <span
              role="status"
              aria-live="polite"
              className="flex h-7 items-center gap-2 text-muted-foreground"
            >
              <ThinkingOrb />
              <span className={compact ? "text-sm" : "text-[15px]"}>
                {composing ? t(m.coach.typing) : t(m.coach.thinking)}
              </span>
            </span>
          </div>
        )}

      </div>

      {/* Outside the spaced list: as a child of it, the anchor would inherit
          the gap and leave a message-sized hole under the last reply. */}
      <div ref={bottomRef} />

      {showJump && (
        <button
          type="button"
          onClick={jumpToLatest}
          className="sticky bottom-2 mx-auto mt-3 flex rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground shadow-xs outline-none hover:bg-muted/70 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-[var(--duration-state)] motion-safe:ease-enter"
        >
          {t(m.coach.jumpToLatest)}
        </button>
      )}
    </div>
  );
}
