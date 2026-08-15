"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";

import { useEveAgent } from "eve/react";

import { coachContext } from "@/lib/actions/context";
import { isActionName } from "@/lib/actions/registry";
import { useAppState, useDispatch } from "@/lib/actions/store";
import { probeAccess, useCoachAccess } from "@/lib/coach/access";
import {
  flatten,
  interleave,
  type CoachMessage,
  type LocalMessage,
} from "@/lib/coach/messages";
import {
  conversationTitle,
  loadConversations,
  removeConversation,
  upsertConversation,
  type Conversation,
} from "@/lib/coach/sessions";
import { useTurnWatchdog } from "@/lib/coach/watchdog";
import { type Msg } from "@/lib/i18n/locale";
import { messages as ui } from "@/lib/i18n/messages";
import { screenInput } from "@/lib/guardrails/input";
import { reportInputFindings, reportOutputFindings } from "@/lib/guardrails/client";
import { checkGrounding } from "@/lib/guardrails/grounding";
import { checkOutput } from "@/lib/guardrails/output";
import { useTurnTrace } from "@/lib/trace/use-turn-trace";
import { pickReply } from "./replies";

/** What `agent/tools/apply_action.ts` returns on a successful call. */
type ApplyActionEnvelope = {
  ok: boolean;
  action: string;
  input: Record<string, unknown>;
  /** The registry's own confirmation line. Only ever set from the envelope. */
  summary: Msg;
};

/**
 * A fresh conversation id.
 *
 * Random rather than a counter, because two tabs open at once would both mint
 * "chat-3" and then overwrite each other in storage.
 */
function newConversationId(): string {
  return `chat-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Conversation state shared by the Coach page and the floating panel.
 *
 * `restore` is false on the render that has to match the server's markup, and
 * true on the remount straight after. See `provider.tsx`: reading the stored
 * session during hydration made the header disagree with what the server sent.
 *
 * `selectedId` names which stored conversation this instance is. `useEveAgent`
 * takes its events at store creation and cannot be handed a different thread
 * afterwards, so switching is a remount, keyed on this id by the provider.
 * `null` means "whichever is newest", which is what a returning visitor wants
 * and what the first render after hydration resolves.
 */
export function useCoachThread({
  restore,
  selectedId,
  onSelect,
}: {
  restore: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const pathname = usePathname();
  const state = useAppState();
  const dispatch = useDispatch();

  // Messages produced without the agent: anything `replies.ts` answered while
  // it was unreachable. Interleaved with the agent's own by `after`, not
  // appended around them.
  const [local, setLocal] = React.useState<LocalMessage[]>([]);
  const [offline, setOffline] = React.useState(false);
  /** The canned path's own "typing" flag; the agent has `status` instead. */
  const [pending, setPending] = React.useState(false);

  const replyTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const idCounter = React.useRef(0);

  // How many messages the agent has produced, so a local message can record
  // where in the thread it belongs. A ref because it is written on every stream
  // event and nothing renders from it directly.
  const agentCount = React.useRef(0);

  // The last question handed to the agent, so a failure arriving on the stream
  // rather than as a rejected send still knows what to answer offline.
  const lastAsked = React.useRef("");
  const fellBack = React.useRef(false);

  // Whether the agent will talk to us at all. See lib/coach/access.ts. `lock`
  // is pulled out by name, not read as `coachAccess.lock`, so callbacks that
  // depend on it can list the stable callback rather than the whole object,
  // which `useCoachAccess` returns fresh every render.
  const coachAccess = useCoachAccess();
  const { lock } = coachAccess;

  /** The canned path: used before the agent exists, and after it has failed. */
  const answerLocally = React.useCallback(
    (question: string) => {
    setPending(true);
    const reply = pickReply(question);
    replyTimer.current = setTimeout(() => {
      setPending(false);
      idCounter.current += 1;
      setLocal((prev) => [
        ...prev,
        {
          id: `coach-${idCounter.current}`,
          role: "coach",
          content: reply.content,
          after: agentCount.current,
        },
      ]);
      }, 1200);
    },
    [],
  );

  /**
   * Say something in the thread without asking a model.
   *
   * How the guards answer. A refusal or a redirect is a complete, honest reply
   * that costs nothing to produce, so it is written straight into the thread
   * rather than sent to a model that would only be told to say the same thing.
   */
  const sayLocally = React.useCallback((content: string) => {
    idCounter.current += 1;
    setLocal((prev) => [
      ...prev,
      {
        id: `coach-${idCounter.current}`,
        role: "coach",
        content,
        after: agentCount.current,
      },
    ]);
  }, []);

  /**
   * One-way transition to the canned replies.
   *
   * Guarded by a ref because one failed turn can surface twice, as a rejected
   * `send()` and again on the stream via `onError`. Without the guard the user
   * gets two toasts and two coach replies for one failure.
   *
   * Deliberately does not re-add the user's message: the agent already
   * projected it optimistically and keeps it, so a local copy would render the
   * question twice.
   */
  const fallBack = React.useCallback(
    (question: string) => {
      if (fellBack.current) return;
      fellBack.current = true;
      setOffline(true);
      toast.error(ui.coach.offlineTitle, {
        description: ui.coach.offlineBody,
      });
      if (question) answerLocally(question);
    },
    [answerLocally],
  );

  /**
   * A failed turn is two different problems wearing one error.
   *
   * A 401 means the session ended, and the answer is the front door. Anything
   * else means the agent is down, and the answer is the canned replies.
   * Sending a signed-out user to the offline fallback would quietly downgrade
   * them forever, with a toast blaming a service that is working.
   * `useEveAgent`'s error does not carry a status, so this re-probes, which
   * costs no model call.
   */
  const handleTurnFailure = React.useCallback(
    (question: string) => {
      void probeAccess().then((result) => {
        if (result === "locked") {
          lock();
          return;
        }
        fallBack(question);
      });
    },
    [fallBack, lock],
  );

  // Read through refs: `prepareSend` runs outside the render that produced the
  // state it needs, so closing over `state`/`pathname` would send a stale slice.
  const stateRef = React.useRef(state);
  const routeRef = React.useRef(pathname);
  React.useEffect(() => {
    stateRef.current = state;
    routeRef.current = pathname;
  }, [state, pathname]);

  // Last time this turn showed any sign of life. The watchdog below reads it;
  // every stream event resets it.
  const lastProgress = React.useRef(0);

  // Read once, at store creation: `useEveAgent` takes these when it builds its
  // store, so a later value would be ignored.
  // Which stored conversation this mount is, resolved once. Everything below
  // reads `conversationId`, so a turn saved mid-conversation cannot land in a
  // different thread than the one on screen.
  const [opened] = React.useState(() => {
    if (!restore) return { id: selectedId ?? newConversationId(), entry: null };
    const stored = loadConversations();
    const entry =
      (selectedId ? stored.find((c) => c.id === selectedId) : stored[0]) ?? null;
    return { id: entry?.id ?? selectedId ?? newConversationId(), entry };
  });
  const conversationId = opened.id;
  const restored = opened.entry;

  // The list beside the thread. Held as state rather than read on each render,
  // because localStorage is not a reactive source and a `loadConversations()`
  // in the render path would parse every stored event on every keystroke.
  const [conversations, setConversations] = React.useState<Conversation[]>(
    () => (restore ? loadConversations() : []),
  );

  const agent = useEveAgent({
    initialEvents: restored?.events,
    initialSession: restored?.session,
    onError: () => handleTurnFailure(lastAsked.current),
    onEvent: () => {
      lastProgress.current = Date.now();
    },
    // Every turn carries the user's actual state. Without this the Coach is
    // talking to a stranger, and every principle in `agent/instructions.md`
    // that starts "based on the user's profile" is unenforceable.
    prepareSend: (input) => ({
      ...input,
      clientContext: coachContext(stateRef.current, routeRef.current),
    }),
    /**
     * A turn that ends having said nothing is a failure wearing success.
     *
     * Observed once in benchmarking: 498ms, zero tokens, no error. On the
     * stream that is `turn.completed`, so `onError` never fires and the thread
     * would simply stop with no reply and no explanation. A parked question
     * counts as having said something; genuine silence does not.
     */
    onFinish: (snapshot) => {
      // Keep the conversation across reloads. Saved on settle rather than on
      // every event: a turn in flight is not worth persisting, and the next
      // load would replay a half-finished reply.
      //
      // The title is taken here rather than at creation because a brand new
      // conversation has no first question yet, and the first question is the
      // name.
      setConversations(
        upsertConversation({
          id: conversationId,
          title: conversationTitle(snapshot.events),
          savedAt: Date.now(),
          events: snapshot.events,
          session: snapshot.session,
        }),
      );

      const last = snapshot.data.messages.at(-1);
      if (!last || last.role !== "assistant") return;
      if (flatten(last)) return;
      idCounter.current += 1;
      setLocal((prev) => [
        ...prev,
        {
          id: `empty-${idCounter.current}`,
          role: "coach",
          content: ui.coach.emptyTurn,
          after: snapshot.data.messages.length,
        },
      ]);
    },
  });

  // A hung turn has no exit of its own; see lib/coach/watchdog.ts for why
  // 60s and why `stop` and `agent` itself cannot be depended on directly.
  const turnRunning =
    agent.status === "submitted" || agent.status === "streaming";
  useTurnWatchdog({
    turnRunning,
    stop: agent.stop,
    lastAskedRef: lastAsked,
    lastProgressRef: lastProgress,
    onTimeout: handleTurnFailure,
  });

  // The browser is the only participant that sees a whole turn: when it was
  // asked, when it stopped, what it changed, and whether the user kept it.
  const trace = useTurnTrace(turnRunning);

  /**
   * The other half of the loop: apply what the Coach did.
   *
   * `apply_action` runs on the server and deliberately does not mutate; it
   * validates against the action's own schema and returns an envelope. The
   * store lives here, in the browser, so this is the only place that envelope
   * can become a real change.
   *
   * Applied automatically rather than offered as a proposal. "The Coach edits
   * everything on your behalf" is the product promise, and a confirm step on
   * every edit is exactly the friction the coach-first design removes. The
   * safety net is the one `DESIGN.md` already specifies and `dispatch` already
   * implements: act, announce, offer undo, and flash the row that moved.
   *
   * Keyed by `toolCallId` so a re-render, a reconnect, or a replayed stream
   * prefix cannot apply the same edit twice.
   */
  const appliedCalls = React.useRef(new Set<string>());
  React.useEffect(() => {
    for (const message of agent.data.messages) {
      for (const part of message.parts) {
        if (
          part.type !== "dynamic-tool" ||
          part.toolName !== "apply_action" ||
          part.state !== "output-available" ||
          appliedCalls.current.has(part.toolCallId)
        ) {
          continue;
        }
        appliedCalls.current.add(part.toolCallId);
        const envelope = part.output as ApplyActionEnvelope | undefined;
        // The tool already validated, but this is a trust boundary: the value
        // arrived over the wire from a model turn. A bad envelope is dropped
        // rather than dispatched, and the agent's own error path reports it.
        if (!envelope?.ok || !isActionName(envelope.action)) continue;
        // The trace id travels with the dispatch so that pressing undo on the
        // toast can report which turn the user rejected.
        trace.toolSpan(`apply_action:${envelope.action}`, {
          action: envelope.action,
        });
        dispatch(envelope.action, envelope.input, {
          traceId: trace.traceId ?? undefined,
        });
      }
    }
  }, [agent.data.messages, dispatch, trace]);

  React.useEffect(
    () => () => {
      if (replyTimer.current) clearTimeout(replyTimer.current);
    },
    [],
  );

  React.useEffect(() => {
    agentCount.current = agent.data.messages.length;
  }, [agent.data.messages]);

  /**
   * The output guard, on the finished turn.
   *
   * It runs here and not sooner because the check that matters needs both
   * halves: the Coach's words, and whether any action actually succeeded. A
   * sentence claiming a change is correct after a successful tool call and a
   * lie without one, and only the whole turn tells them apart.
   *
   * It revises rather than blocks. The reply has already streamed into view by
   * the time the turn ends, so the honest move is to add the correction under
   * it, which is also what a person would do on realising they had misspoken.
   */
  const checkedTurns = React.useRef(new Set<string>());
  React.useEffect(() => {
    if (turnRunning) return;
    const last = agent.data.messages.at(-1);
    if (!last || last.role !== "assistant" || checkedTurns.current.has(last.id)) {
      return;
    }
    checkedTurns.current.add(last.id);

    const text = last.parts
      .filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text)
      .join("\n")
      .trim();
    if (!text) return;

    const toolResults = last.parts
      .filter((part) => part.type === "dynamic-tool" && part.toolName === "apply_action")
      .map((part) => {
        const envelope = (part as { output?: ApplyActionEnvelope }).output;
        return { action: envelope?.action ?? "", ok: Boolean(envelope?.ok) };
      });

    const verdict = checkOutput({ reply: text, toolResults });
    if (verdict.findings.length > 0) {
      reportOutputFindings(verdict.findings, trace.traceId, verdict.kind !== "allow");
      if (verdict.kind === "revise") {
        // Only the correction is appended. The reply itself stays as the agent
        // rendered it, so nothing the user already read changes under them.
        sayLocally(ui.guardrails.noActionTaken);
      }
    }

    // And the grounding check, against the profile the user can see. Separate
    // from the check above because it asks a different question: not "did this
    // happen" but "where did this come from".
    const grounded = checkGrounding({
      reply: text,
      state,
      userSaid: lastAsked.current ?? "",
    });
    if (grounded.findings.length === 0) return;
    reportOutputFindings(grounded.findings, trace.traceId, grounded.kind === "revise");
    if (grounded.kind === "revise") sayLocally(ui.guardrails.notGrounded);
  }, [agent.data.messages, turnRunning, sayLocally, trace.traceId, state]);

  const messages = React.useMemo<CoachMessage[]>(
    () => interleave(local, agent.data.messages),
    [local, agent.data.messages],
  );

  const isTyping =
    agent.status === "submitted" || agent.status === "streaming" || pending;

  /**
   * Whether the Coach can take a message at all right now.
   *
   * "checking" counts as busy. The door is probed once on mount, and a question
   * sent into that window comes back 401, locks the thread, and is lost behind
   * the sign-in form with nothing said about it. The handed-over `?q=` already
   * waits for this; someone typing deserves the same guard.
   */
  const busy = isTyping || coachAccess.access !== "open";

  /**
   * Put a question to the Coach and render both halves of the exchange.
   *
   * Online the agent owns both: it projects the user's message optimistically
   * and streams the reply. Offline this appends the user's message and lets
   * `replies.ts` answer. Callers must not add the user's message themselves,
   * or the online path renders it twice.
   */
  const ask = React.useCallback(
    (text: string) => {
      // The input guard, before anything is sent or billed. A refusal and a
      // redirect are both complete answers, so the thread shows the user's
      // question and the Coach's reply exactly as a real turn would, and no
      // model is asked to produce a sentence we already know.
      const screened = screenInput({ text });
      if (screened.kind === "refuse" || screened.kind === "redirect") {
        idCounter.current += 1;
        setLocal((prev) => [
          ...prev,
          {
            id: `user-${idCounter.current}`,
            role: "user",
            content: text,
            after: agentCount.current,
          },
        ]);
        sayLocally(screened.reply);
        reportInputFindings(screened.findings, trace.traceId);
        return;
      }
      // A redaction is not a refusal: the question is a real one, it simply
      // travels without the number in it. The user is told, because a message
      // silently altered on its way out is the kind of thing that destroys
      // trust when it is noticed later.
      if (screened.kind === "redact") {
        sayLocally(ui.guardrails.sensitiveRemoved);
        reportInputFindings(screened.findings, trace.traceId);
        text = screened.text;
      }

      if (offline) {
        // Offline is a state, not a verdict. It used to be a one-way latch: one
        // hung turn dropped the thread to canned replies and nothing ever put it
        // back, so a user whose connection recovered a second later kept getting
        // "I've lost my connection" from a healthy server, with no way out but
        // discarding the conversation. Every question is now also a retry.
        idCounter.current += 1;
        const localId = `user-${idCounter.current}`;
        setLocal((prev) => [
          ...prev,
          {
            id: localId,
            role: "user",
            content: text,
            after: agentCount.current,
          },
        ]);
        // Shown while the probe runs, which can take up to its 8s deadline.
        setPending(true);
        void probeAccess().then((result) => {
          setPending(false);
          if (result === "locked") {
            lock();
            return;
          }
          if (result === "unreachable") {
            answerLocally(text);
            return;
          }
          // Back. Drop our copy of the question: the agent projects its own,
          // and two would render the same sentence twice.
          setLocal((prev) => prev.filter((message) => message.id !== localId));
          setOffline(false);
          fellBack.current = false;
          toast.success(ui.coach.backOnline);
          lastAsked.current = text;
          agent.send({ message: text }).catch(() => handleTurnFailure(text));
        });
        return;
      }
      lastAsked.current = text;
      // `send` rejects when a turn is already in flight; swallowing it here
      // would be an unhandled rejection, and a real failure needs the fallback.
      agent.send({ message: text }).catch(() => handleTurnFailure(text));
    },
    [agent, answerLocally, handleTurnFailure, lock, offline, sayLocally, trace.traceId],
  );

  /**
   * A question handed over from another screen (`/coach?q=`).
   *
   * Identical to `send` now that a real agent owns the user's turn. It stays a
   * separate name because the caller's intent differs: this one is not typed
   * into the composer, so it bypasses the in-flight guard.
   */
  const answer = ask;

  const send = React.useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text || busy) return;
      ask(text);
    },
    [ask, busy],
  );

  /**
   * The half-written question, held here rather than in each surface.
   *
   * `/coach` and the floating panel are two views of one conversation, which is
   * the whole reason `provider.tsx` exists. A draft is part of that
   * conversation: each surface keeping its own `useState` meant typing into the
   * panel and pressing "Open full screen" threw the text away.
   */
  const [draft, setDraft] = React.useState("");

  const submitDraft = React.useCallback(() => {
    if (busy || !draft.trim()) return;
    send(draft);
    setDraft("");
  }, [busy, draft, send]);

  // The suggestion card is gone. It rendered "Coach đề xuất" with an Accept
  // button whose handler only ever showed a toast naming a role from the old
  // seed data; nothing was added to the map or the plan. Nothing has been able
  // to produce a suggestion since the seeded conversation was removed either,
  // so this was dead code carrying a false claim. The Coach adds things for
  // real now, through `apply_action`.

  /**
   * Answer a question the Coach parked on.
   *
   * The turn is suspended durably server-side, so this resumes it rather than
   * starting a new one. Failure takes the same split as any other turn: a 401
   * is the door, anything else is the offline path.
   */
  const respond = React.useCallback(
    (requestId: string, optionId: string) => {
      agent
        .send({ inputResponses: [{ requestId, optionId }] })
        .catch(() => handleTurnFailure(""));
    },
    [agent, handleTurnFailure],
  );

  /**
   * Abandon the turn in flight.
   *
   * Only stops this client waiting; eve's turn keeps running server-side, and
   * if it lands later the reducer still applies it, with Coach edits deduped by
   * `toolCallId` so nothing double-applies. That is the right trade: the user
   * wants their composer back, not a cancelled database write.
   *
   * This exists because the model reasons before it answers, which is what
   * makes it able to call tools at all (see agent/agent.ts) and costs upwards
   * of 50 seconds on a simple question. Fifty seconds of bouncing dots with no
   * way out is the point at which a person decides the product is broken.
   */
  const stop = React.useCallback(() => {
    agent.stop();
    setPending(false);
    if (replyTimer.current) clearTimeout(replyTimer.current);
  }, [agent]);

  /**
   * Start a new conversation, keeping the ones already there.
   *
   * This used to clear storage and reset the agent in place, because there was
   * one thread and starting a new one meant destroying it. Now it opens a new
   * id and lets the provider remount onto it; the previous conversation is
   * saved and stays in the list.
   */
  const startNewChat = React.useCallback(() => {
    onSelect(newConversationId());
  }, [onSelect]);

  /** Open a conversation that already exists. */
  const switchTo = React.useCallback(
    (id: string) => {
      if (id !== conversationId) onSelect(id);
    },
    [conversationId, onSelect],
  );

  /**
   * Throw one away. Deleting the open one lands on whatever is newest after
   * it, or on a fresh thread when it was the last.
   */
  const deleteConversation = React.useCallback(
    (id: string) => {
      const next = removeConversation(id);
      setConversations(next);
      if (id === conversationId) onSelect(next[0]?.id ?? newConversationId());
    },
    [conversationId, onSelect],
  );

  return {
    messages,
    isTyping,
    /** Sending is refused: a turn is in flight, or the door has not opened. */
    busy,
    draft,
    setDraft,
    submitDraft,
    startNewChat,
    /** Every stored conversation, newest first. */
    conversations,
    /** Which of them is on screen. */
    conversationId,
    switchTo,
    deleteConversation,
    send,
    stop,
    answer,
    respond,
    /** "locked" means the session ended: show the way back, not the thread. */
    access: coachAccess.access,
  };
}

export type CoachThread = ReturnType<typeof useCoachThread>;
