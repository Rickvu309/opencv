// Scripted turns, so the chat can be built and tested without a model.
//
// ## Why not the shadcn `ai-sdk` helper
//
// That helper (`createChat()`) exists for exactly this problem and is the right
// tool for an app built on `useChat`. This one is not: eve owns the transport,
// the session and the reducer, and what our components actually render is
// `EveMessage` — eve's own projection, which follows the AI SDK parts
// convention but is produced by `useEveAgent`, not by a `ChatTransport`.
// Adopting the helper would mean installing `@ai-sdk/react` for a hook we never
// call, then writing a UIMessage → EveMessage adapter whose only consumer is
// the tests. The fixtures below are the same idea one layer lower down, in the
// shape the code under test actually receives.
//
// ## Why this matters
//
// A turn costs upwards of fifty seconds and real NVIDIA tokens, and half the
// states worth rendering are ones you cannot summon on demand: a refused call,
// a schema failure, a turn that reasons for a minute and says nothing. Every
// one of them is one line here.
//
// Test-only, and used by the development harness at /dev/chat. Nothing in the
// production bundle imports it.

import type { EveMessage, EveMessagePart } from "eve/react";

let seq = 0;
const nextId = (prefix: string) => `${prefix}-${(seq += 1)}`;

/** Reset ids so a test file's expectations do not depend on run order. */
export function resetFixtureIds() {
  seq = 0;
}

export function userTurn(text: string): EveMessage {
  return {
    id: nextId("u"),
    role: "user",
    parts: [{ type: "text", text, state: "done" }],
  };
}

/** An assistant message built from whichever parts a case needs. */
export function coachTurn(...parts: EveMessagePart[]): EveMessage {
  return { id: nextId("a"), role: "assistant", parts };
}

export function text(value: string, streaming = false): EveMessagePart {
  return { type: "text", text: value, state: streaming ? "streaming" : "done" };
}

export function reasoning(value: string, streaming = false): EveMessagePart {
  return {
    type: "reasoning",
    text: value,
    state: streaming ? "streaming" : "done",
  };
}

type ToolOptions = {
  action?: string;
  summary?: string;
  errorText?: string;
  error?: string;
};

/**
 * An `apply_action` part in any one of its lifecycle states.
 *
 * The states are eve's, not ours: `input-streaming` and `input-available` while
 * the arguments arrive, `approval-requested` and `approval-responded` around a
 * human decision, then one of `output-available`, `output-error` or
 * `output-denied`.
 */
export function toolPart(
  state:
    | "input-streaming"
    | "input-available"
    | "approval-requested"
    | "approval-responded"
    | "output-available"
    | "output-error"
    | "output-denied",
  options: ToolOptions = {},
): EveMessagePart {
  const base = {
    type: "dynamic-tool" as const,
    toolCallId: nextId("call"),
    toolName: "apply_action",
    input: { action: options.action ?? "profile.addCourse", input: {} },
  };

  switch (state) {
    case "output-available":
      return {
        ...base,
        state,
        output: options.error
          ? { ok: false, error: options.error }
          : {
              ok: true,
              action: options.action ?? "profile.addCourse",
              input: {},
              summary: options.summary ?? "Added “learn SQL”",
            },
      } as EveMessagePart;
    case "output-error":
      return {
        ...base,
        state,
        errorText: options.errorText ?? "upstream refused the call",
      } as EveMessagePart;
    case "output-denied":
      return {
        ...base,
        state,
        approval: { id: "ap-1", approved: false },
      } as EveMessagePart;
    case "approval-requested":
      return { ...base, state, approval: { id: "ap-1" } } as EveMessagePart;
    default:
      return { ...base, state } as EveMessagePart;
  }
}

/**
 * A destructive call parked on the user's decision.
 *
 * eve raises this as an input request like any other, discriminated by
 * `kind: "tool-approval"`, so it travels the same path as a question the Coach
 * asks. The thread has to tell the two apart: one is conversation, the other is
 * a thing about to be deleted.
 */
export function approvalPart(prompt: string): EveMessagePart {
  return {
    type: "dynamic-tool",
    toolCallId: nextId("call"),
    toolName: "apply_action",
    state: "approval-requested",
    input: { action: "paper.remove", input: { id: "t-1" } },
    approval: { id: nextId("ap") },
    toolMetadata: {
      eve: {
        kind: "tool-call",
        name: "apply_action",
        inputRequest: {
          kind: "tool-approval",
          display: "confirmation",
          requestId: nextId("req"),
          prompt,
          options: [
            { id: "approve", label: "Xoá việc này", style: "danger" },
            { id: "deny", label: "Giữ lại" },
          ],
        },
      },
    },
  } as EveMessagePart;
}

/**
 * The cases worth looking at, named. The development harness renders every one
 * of these on a single screen so a change to the thread can be judged against
 * all of them at once rather than against whichever one the live model happened
 * to produce.
 */
export const scenarios: { id: string; label: string; messages: EveMessage[] }[] =
  [
    {
      id: "plain",
      label: "A plain answer",
      messages: [
        userTurn("Mình nên bắt đầu từ đâu?"),
        coachTurn(text("Bắt đầu từ SQL.\n\n- Join và aggregate\n- Một dự án nhỏ")),
      ],
    },
    {
      id: "thinking",
      label: "Reasoning, still streaming",
      messages: [
        userTurn("Mình hợp hướng nào?"),
        coachTurn(
          reasoning(
            "Hồ sơ cho thấy nền Marketing, chưa có kinh nghiệm dữ liệu.\n" +
              "Cần cân nhắc giữa Data Analyst và Digital Marketing.",
            true,
          ),
        ),
      ],
    },
    {
      id: "thought-then-answered",
      label: "Reasoning, finished, then an answer",
      messages: [
        userTurn("Mình hợp hướng nào?"),
        coachTurn(
          reasoning("Nền Marketing, chưa có kinh nghiệm dữ liệu."),
          text("Digital Marketing là bước gần nhất với những gì bạn đã có."),
        ),
      ],
    },
    {
      id: "tool-running",
      label: "A change in flight",
      messages: [
        userTurn("Thêm việc: học SQL"),
        coachTurn(toolPart("input-available")),
      ],
    },
    {
      id: "tool-done",
      label: "A change that landed",
      messages: [
        userTurn("Thêm việc: học SQL"),
        coachTurn(toolPart("output-available"), text("Xong rồi nhé.")),
      ],
    },
    {
      id: "tool-rejected-payload",
      label: "A change the schema refused",
      messages: [
        userTurn("Thêm việc"),
        coachTurn(
          toolPart("output-available", { error: "Invalid input for profile.addCourse" }),
          text("Mình đã thêm việc đó vào danh sách của bạn."),
        ),
      ],
    },
    {
      id: "tool-error",
      label: "A change that failed upstream",
      messages: [
        userTurn("Thêm việc: học SQL"),
        coachTurn(toolPart("output-error")),
      ],
    },
    {
      id: "tool-denied",
      label: "A change the user refused",
      messages: [
        userTurn("Xoá hết việc trong danh sách"),
        coachTurn(toolPart("output-denied", { action: "paper.remove" })),
      ],
    },
    {
      id: "cv-artifact",
      label: "A CV built in the conversation",
      messages: [
        userTurn("Dựng CV cho mình từ hồ sơ"),
        coachTurn(
          toolPart("output-available", {
            action: "paper.create",
            summary: "Created a new CV",
          }),
          text("Xong bản đầu rồi. Phần Giới thiệu còn trống, bạn viết ba câu nhé."),
        ),
      ],
    },
    {
      id: "approval",
      label: "A deletion waiting on the user",
      messages: [
        userTurn("Bỏ việc học SQL đi"),
        coachTurn(
          approvalPart("Xoá việc “học SQL cơ bản trong tuần này” khỏi danh sách?"),
        ),
      ],
    },
    {
      id: "everything",
      label: "Reasoning, a change, and an answer",
      messages: [
        userTurn("Dựng CV cho mình"),
        coachTurn(
          reasoning("Hồ sơ đã có tên, trường, mục tiêu. Đủ để dựng bản đầu."),
          toolPart("output-available", {
            action: "paper.create",
            summary: "Created a new CV",
          }),
          text("Mình dựng xong bản đầu rồi. Bạn xem lại phần Giới thiệu nhé."),
        ),
      ],
    },
  ];
