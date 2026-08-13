import type { EveMessage, EveMessageInputRequest } from "eve/react";

import type { ChatMessage } from "@/lib/catalog";
import type { Msg } from "@/lib/i18n/locale";
import { messages as uiMessages } from "@/lib/i18n/messages";

/** A change the Coach actually made, read back from the tool's own result. */
export type AppliedAction = { action: string; summary: Msg };

/**
 * One `apply_action` call, at whatever point of its life it has reached.
 *
 * eve advances a tool part through seven states; we used to read exactly one of
 * them (`output-available`) and render nothing for the rest, so a call that was
 * still running, or had been refused, or had failed, looked identical to a turn
 * that never called anything: silence.
 */
export type CoachToolCall = {
  id: string;
  /**
   * `awaiting` is a call parked on the user's decision. It renders as nothing:
   * the approval card beside it is already saying what is about to happen, and
   * a "making the change…" chip under it would be both wrong and alarming.
   */
  state: "running" | "awaiting" | "done" | "error" | "denied";
  /** The registry action, once the arguments have finished arriving. */
  action?: string;
  /** The registry's own confirmation line. Only ever set from the envelope. */
  summary?: Msg;
  errorText?: string;
  /**
   * The action's payload, so the thread can show *what* was changed and not
   * only that something was. Used to find the CV a `resume.*` call was aimed
   * at; see components/coach/resume-artifact.tsx.
   */
  input?: Record<string, unknown>;
};

/** The Coach's working, when the model reasons before answering. */
export type CoachReasoning = { text: string; streaming: boolean };

export type CoachMessage = ChatMessage & {
  question?: EveMessageInputRequest;
  /** Changes this message actually made. See `toolCalls`. */
  tools?: CoachToolCall[];
  /** What it thought on the way. See `reasoningOf`. */
  reasoning?: CoachReasoning;
};

/**
 * A message this app wrote rather than the agent: the user's own question while
 * offline, an answer from `replies.ts`, or the notice for a turn that finished
 * having said nothing.
 *
 * `after` is how many agent messages existed when it was written, which is the
 * only thing that can order it against a stream this side does not control.
 */
export type LocalMessage = ChatMessage & { after: number };

/**
 * What to call the thread right now. There is one live thread, so this names
 * its state rather than picking a name from several conversations.
 *
 * Returns the pair rather than a string: the caller resolves it against the
 * user's language, and a title is the one label on screen at all times.
 */
export function chatTitle(messages: CoachMessage[]): Msg {
  return messages.length === 0
    ? uiMessages.coach.newChat
    : uiMessages.coach.ongoingChat;
}

/** The pending question on a message, if the turn parked to ask one. */
export function pendingQuestion(message: EveMessage): EveMessageInputRequest | undefined {
  for (const part of message.parts) {
    if (part.type !== "dynamic-tool") continue;
    const request = part.toolMetadata?.eve?.inputRequest;
    // Only while it is still pending: once answered, the reducer keeps the part
    // and re-rendering the buttons would invite a second answer to a question
    // eve has already resumed past.
    if (request && !part.toolMetadata?.eve?.inputResponse) return request;
  }
  return undefined;
}

/**
 * The changes a message actually made.
 *
 * Read from `apply_action`'s returned envelope, never from the reply's prose.
 * The model will write "mình đã thêm việc đó vào danh sách" having called
 * nothing at all — measured, reproducibly, and the list stays empty while the
 * user is told otherwise. Rendering the confirmation from the envelope means an
 * uncalled tool produces no confirmation, so the claim and the change cannot
 * come apart no matter what the prose says.
 */
export function appliedActions(message: EveMessage): AppliedAction[] {
  return toolCalls(message)
    .filter((call) => call.state === "done" && call.action && call.summary)
    .map((call) => ({ action: call.action!, summary: call.summary! }));
}

/**
 * Every `apply_action` call on this message, in whatever state it has reached.
 *
 * The success case still reads its confirmation out of the returned envelope
 * and nowhere else, which is the rule that stops the Coach claiming changes it
 * has not made. What is new is the other five states: a call in flight, a call
 * the user refused, a call that failed. Rendering only the happy path meant a
 * fifty-second turn showed nothing at all while it worked, and a rejected
 * payload disappeared with the reply talking as if it had landed.
 */
export function toolCalls(message: EveMessage): CoachToolCall[] {
  const calls: CoachToolCall[] = [];

  for (const part of message.parts) {
    if (part.type !== "dynamic-tool" || part.toolName !== "apply_action") {
      continue;
    }

    const call = part.input as
      | { action?: string; input?: Record<string, unknown> }
      | undefined;
    const base = {
      id: part.toolCallId,
      action: call?.action,
      input: call?.input,
    };

    switch (part.state) {
      case "approval-requested":
        calls.push({ ...base, state: "awaiting" });
        break;
      case "input-streaming":
      case "input-available":
      case "approval-responded":
        calls.push({ ...base, state: "running" });
        break;
      case "output-denied":
        calls.push({ ...base, state: "denied" });
        break;
      case "output-error":
        calls.push({ ...base, state: "error", errorText: part.errorText });
        break;
      case "output-available": {
        const output = part.output as
          | {
              ok?: boolean;
              action?: string;
              summary?: Msg;
              error?: string;
              input?: unknown;
            }
          | undefined;
        // The tool answers `ok: false` for a payload that failed its schema.
        // That is a real failure and the user is owed it; it used to be
        // dropped on the floor while the reply carried on regardless.
        if (!output?.ok) {
          calls.push({ ...base, state: "error", errorText: output?.error });
          break;
        }
        calls.push({
          ...base,
          action: output.action ?? base.action,
          // The envelope carries the *parsed* payload, with defaults filled in
          // and coercions applied, which is what actually ran.
          input: (output.input as Record<string, unknown>) ?? base.input,
          state: "done",
          summary: output.summary,
        });
        break;
      }
    }
  }

  return calls;
}

/**
 * The model's working, concatenated in order.
 *
 * Thrown away until now, which was affordable when the model answered in two
 * seconds and is not now that it reasons first: `enable_thinking` is on because
 * it is the only way this model calls tools at all, and it costs upwards of
 * fifty seconds during which the reasoning is the *only* thing on the wire.
 */
export function reasoningOf(message: EveMessage): CoachReasoning | undefined {
  const parts = message.parts.filter((part) => part.type === "reasoning");
  if (parts.length === 0) return undefined;
  const text = parts.map((part) => part.text).join("").trim();
  const streaming = parts.some((part) => part.state === "streaming");
  if (!text && !streaming) return undefined;
  return { text, streaming };
}

/**
 * Flatten one eve message into the shape this UI renders.
 *
 * `data.messages` follows the AI SDK `UIMessage` convention: a message is a
 * list of parts, of which `text` is only one. This used to keep that one and
 * drop the rest as debug noise, which was defensible while the model answered
 * in two seconds without tools. It reasons for the better part of a minute now,
 * and it operates the app, so the reasoning and the tool calls *are* the turn;
 * dropping them left the user watching nothing happen. Step markers are still
 * dropped, because they mark structure the reader has no use for.
 *
 * A pending question is the exception, and the reason this returns more than a
 * string. The agent asks before it guesses, which is `instructions.md` rule 1
 * working, but the question arrives as a `dynamic-tool` part rather than text.
 * Dropping it made the Coach do the right thing and say nothing.
 */
export function flatten(message: EveMessage): CoachMessage | null {
  const content = message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("")
    .trim();
  const question = pendingQuestion(message);
  const tools = toolCalls(message);
  const reasoning = reasoningOf(message);
  // Nothing at all: the first frame of a streaming turn, before even the
  // reasoning has started. Skipped rather than rendered as an empty bubble.
  // Anything else renders, because a message that is only thinking, or only
  // changed something, is still the Coach doing visible work.
  if (!content && !question && tools.length === 0 && !reasoning) return null;
  return {
    id: message.id,
    role: message.role === "assistant" ? "coach" : "user",
    content,
    ...(question ? { question } : {}),
    ...(tools.length > 0 ? { tools } : {}),
    ...(reasoning ? { reasoning } : {}),
  };
}

/**
 * One ordered thread out of two producers.
 *
 * The agent's messages carry the order the stream gave them; local ones carry
 * the agent count they were written at. Walking the agent's list and draining
 * the local queue at each boundary interleaves them without either side needing
 * a clock. `local` is expected in `after` order, which it is, because the count
 * it reads only ever grows.
 *
 * Concatenating the two lists instead — `[...local, ...agent]` — put every
 * local message above the whole conversation. The first failed turn rendered
 * the Coach's offline reply above the question that caused it, because the
 * agent had already projected that question optimistically, and every offline
 * exchange after that stacked on top of the online one. The thread read
 * backwards from the first failure onward.
 */
export function interleave(
  local: readonly LocalMessage[],
  agentMessages: readonly EveMessage[],
): CoachMessage[] {
  const thread: CoachMessage[] = [];
  let next = 0;

  const drain = (upTo: number) => {
    while (next < local.length && local[next].after <= upTo) {
      thread.push(local[next]);
      next += 1;
    }
  };

  drain(0);
  agentMessages.forEach((message, index) => {
    const flat = flatten(message);
    if (flat) thread.push(flat);
    drain(index + 1);
  });
  // Anything recorded past the end of the stream, which `agent.reset()` can
  // produce mid-flight. Better last than dropped.
  drain(Number.POSITIVE_INFINITY);

  return thread;
}

/**
 * One renderable block of a Coach reply.
 *
 * The Coach writes markdown-ish prose: paragraphs separated by blank lines,
 * and lists whose items are separated by a *single* newline. The thread used to
 * split on `\n\n` only and render each block as one `<p>`, which meant every
 * single newline collapsed into a space and a bullet list arrived as one run-on
 * sentence: "bạn sẽ có: - 1 dự án portfolio - CV và LinkedIn - Đã tạo được".
 * Observed in a real production reply.
 */
export type ProseBlock =
  | { kind: "paragraph"; lines: string[] }
  | { kind: "bullets"; items: string[] }
  | { kind: "numbered"; items: { marker: string; text: string }[] };

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*(\d+)[.)]\s+(.*)$/;

/** Split a reply into blocks the thread can render without losing a newline. */
export function parseProse(content: string): ProseBlock[] {
  const blocks: ProseBlock[] = [];

  for (const raw of content.split(/\n{2,}/)) {
    const lines = raw.split("\n").filter((line) => line.trim().length > 0);
    if (lines.length === 0) continue;

    // A list is a run of lines that all carry the same marker. Mixed content
    // (a lead-in sentence, then bullets) splits into a paragraph and a list
    // rather than forcing one shape onto both.
    let index = 0;
    while (index < lines.length) {
      const bullets: string[] = [];
      while (index < lines.length) {
        const match = lines[index].match(BULLET);
        if (!match) break;
        bullets.push(match[1]);
        index += 1;
      }
      if (bullets.length > 0) {
        blocks.push({ kind: "bullets", items: bullets });
        continue;
      }

      const numbered: { marker: string; text: string }[] = [];
      while (index < lines.length) {
        const match = lines[index].match(NUMBERED);
        if (!match) break;
        numbered.push({ marker: match[1], text: match[2] });
        index += 1;
      }
      if (numbered.length > 0) {
        blocks.push({ kind: "numbered", items: numbered });
        continue;
      }

      const paragraph: string[] = [];
      while (
        index < lines.length &&
        !BULLET.test(lines[index]) &&
        !NUMBERED.test(lines[index])
      ) {
        paragraph.push(lines[index]);
        index += 1;
      }
      if (paragraph.length > 0) blocks.push({ kind: "paragraph", lines: paragraph });
    }
  }

  return blocks;
}
