// The projection from eve's message parts to what the thread renders.
//
// This is where the Coach went silent: it asked a good question, the question
// arrived as a tool part rather than text, and the projection threw it away.
// The rule these tests enforce is the one the ticket set: a turn that produced
// something must never flatten to nothing.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  appliedActions,
  flatten,
  interleave,
  parseProse,
  pendingQuestion,
  toolCalls,
  type LocalMessage,
} from "@/lib/coach/messages";
import {
  coachTurn,
  reasoning,
  scenarios,
  text,
  toolPart,
} from "@/lib/coach/fixture";

/** Shapes matching eve's `EveMessage`, narrow enough to build by hand. */
function textMessage(text: string) {
  return {
    id: "m1",
    role: "assistant" as const,
    parts: [{ type: "text" as const, text, state: "done" as const }],
  };
}

function questionMessage(answered = false) {
  return {
    id: "m2",
    role: "assistant" as const,
    parts: [
      {
        type: "dynamic-tool" as const,
        toolCallId: "call-1",
        toolName: "ask_question",
        state: "approval-requested" as const,
        input: {},
        approval: { id: "a1" },
        toolMetadata: {
          eve: {
            kind: "tool-call" as const,
            name: "ask_question",
            inputRequest: {
              kind: "question" as const,
              requestId: "req-1",
              prompt: "Bạn đang ở giai đoạn nào?",
              allowFreeform: true,
              options: [
                { id: "student", label: "Sinh viên" },
                { id: "grad", label: "Mới tốt nghiệp" },
              ],
            },
            ...(answered
              ? { inputResponse: { requestId: "req-1", optionId: "student" } }
              : {}),
          },
        },
      },
    ],
  };
}

/** One agent message, id and role varied so a thread can be built from several. */
function agentMessage(id: string, role: "user" | "assistant", text: string) {
  return {
    id,
    role,
    parts: [{ type: "text" as const, text, state: "done" as const }],
  };
}

function localMessage(
  id: string,
  role: "user" | "coach",
  content: string,
  after: number,
): LocalMessage {
  return { id, role, content, after };
}

test("prose flattens to a coach message", () => {
  const message = flatten(textMessage("Chào bạn."));
  assert.equal(message?.role, "coach");
  assert.equal(message?.content, "Chào bạn.");
  assert.equal(message?.question, undefined);
});

test("a parked question survives the projection", () => {
  // The regression this ticket exists for. Before the fix this returned null
  // and the user watched the typing indicator stop with nothing arriving.
  const message = flatten(questionMessage());
  assert.ok(message, "a turn that asked a question must render something");
  assert.equal(message.question?.prompt, "Bạn đang ở giai đoạn nào?");
  assert.equal(message.question?.options?.length, 2);
  assert.equal(message.question?.requestId, "req-1");
});

test("an answered question stops rendering its buttons", () => {
  // eve keeps the part after the response. Re-offering the options would invite
  // a second answer to a question the turn has already resumed past.
  assert.equal(pendingQuestion(questionMessage(true)), undefined);
  assert.equal(flatten(questionMessage(true)), null);
});

test("a turn with neither text nor a question is skipped", () => {
  // The first frame of a stream, or a turn that only called a tool. Rendering
  // this would put an empty bubble in the thread.
  const streaming = {
    id: "m3",
    role: "assistant" as const,
    parts: [{ type: "step-start" as const }],
  };
  assert.equal(flatten(streaming), null);
});

test("whitespace-only text counts as nothing", () => {
  assert.equal(flatten(textMessage("   \n  ")), null);
});

test("streamed text parts concatenate in order", () => {
  const streamed = {
    id: "m4",
    role: "assistant" as const,
    parts: [
      { type: "text" as const, text: "Hai tuần ", state: "done" as const },
      { type: "text" as const, text: "tới bạn nên", state: "streaming" as const },
    ],
  };
  assert.equal(flatten(streamed)?.content, "Hai tuần tới bạn nên");
});

test("reasoning is kept apart from the reply, not mixed into it", () => {
  // This used to assert that reasoning was discarded entirely, on the grounds
  // that visible chain-of-thought would be noise. That held while the model
  // answered in two seconds. It reasons for the better part of a minute now,
  // because that is the only way it calls tools at all, so the reasoning is
  // most of what there is to show — but it is its own channel, never spliced
  // into the sentence the user is meant to read.
  const withReasoning = {
    id: "m5",
    role: "assistant" as const,
    parts: [
      { type: "reasoning" as const, text: "The user is a student...", state: "done" as const },
      { type: "text" as const, text: "Bạn nên bắt đầu từ SQL.", state: "done" as const },
    ],
  };
  const flat = flatten(withReasoning);
  assert.equal(flat?.content, "Bạn nên bắt đầu từ SQL.");
  assert.equal(flat?.reasoning?.text, "The user is a student...");
});

// The reported bug: "not go to next row". A single newline is a line break the
// Coach meant, and the thread used to collapse it into a space.

test("a bullet list keeps one item per line", () => {
  // Taken from a real production reply, which rendered as one run-on sentence:
  // "bạn sẽ có: - 1 dự án portfolio - CV và LinkedIn - Đã tạo được".
  const blocks = parseProse(
    "Sau 2 tuần bạn sẽ có:\n- 1 dự án portfolio\n- CV đã chỉnh\n- Bài đăng đầu tiên",
  );
  assert.equal(blocks.length, 2, "a lead-in line and a list, not one paragraph");
  assert.equal(blocks[0].kind, "paragraph");
  assert.equal(blocks[1].kind, "bullets");
  assert.deepEqual(blocks[1].kind === "bullets" ? blocks[1].items : [], [
    "1 dự án portfolio",
    "CV đã chỉnh",
    "Bài đăng đầu tiên",
  ]);
});

test("a numbered list separated by single newlines stays a list", () => {
  const blocks = parseProse("1. Học SQL\n2. Làm portfolio\n3. Sửa CV");
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].kind, "numbered");
  const items = blocks[0].kind === "numbered" ? blocks[0].items : [];
  assert.deepEqual(items.map((i) => i.marker), ["1", "2", "3"]);
  assert.equal(items[2].text, "Sửa CV");
});

test("single newlines inside a paragraph are kept as lines", () => {
  const blocks = parseProse("Dòng một\nDòng hai");
  assert.equal(blocks.length, 1);
  assert.deepEqual(
    blocks[0].kind === "paragraph" ? blocks[0].lines : [],
    ["Dòng một", "Dòng hai"],
  );
});

test("blank lines still separate paragraphs", () => {
  const blocks = parseProse("Đoạn một.\n\nĐoạn hai.");
  assert.equal(blocks.length, 2);
  assert.equal(blocks.every((b) => b.kind === "paragraph"), true);
});

test("bullets written with * or • are recognised too", () => {
  for (const marker of ["-", "*", "•"]) {
    const blocks = parseProse(`${marker} một\n${marker} hai`);
    assert.equal(blocks[0].kind, "bullets", `${marker} should start a list`);
  }
});

test("a lone digit sentence is not mistaken for a list", () => {
  // "2024 là năm..." must stay prose; the marker needs a delimiter.
  const blocks = parseProse("2024 là năm bạn nên bắt đầu.");
  assert.equal(blocks[0].kind, "paragraph");
});

test("empty and whitespace content produce nothing to render", () => {
  assert.deepEqual(parseProse(""), []);
  assert.deepEqual(parseProse("\n\n   \n"), []);
});

// ── interleave ────────────────────────────────────────────────────────────
//
// The thread has two producers: the agent's stream, and this app when the agent
// is unreachable. They used to be concatenated, which ordered the thread by who
// wrote a message rather than when. These pin the order down.

test("with nothing local, the stream is the thread", () => {
  const thread = interleave(
    [],
    [agentMessage("a1", "user", "Chào"), agentMessage("a2", "assistant", "Chào bạn.")],
  );
  assert.deepEqual(
    thread.map((m) => m.id),
    ["a1", "a2"],
  );
});

test("an offline reply lands after the question that caused it", () => {
  // The regression. The agent projects the user's message optimistically and
  // keeps it, so the failed turn's question is already in the stream when
  // `replies.ts` answers. Concatenating put the answer above the question.
  const thread = interleave(
    [localMessage("l1", "coach", "Mình đang mất kết nối.", 1)],
    [agentMessage("a1", "user", "CV của mình ổn chưa?")],
  );
  assert.deepEqual(
    thread.map((m) => m.id),
    ["a1", "l1"],
  );
});

test("an offline exchange continues the online one rather than preceding it", () => {
  const thread = interleave(
    [
      localMessage("l1", "coach", "Mình đang mất kết nối.", 2),
      localMessage("l2", "user", "Thế còn kế hoạch?", 2),
      localMessage("l3", "coach", "Chưa xem được kế hoạch.", 2),
    ],
    [
      agentMessage("a1", "user", "Chào"),
      agentMessage("a2", "assistant", "Chào bạn."),
    ],
  );
  assert.deepEqual(
    thread.map((m) => m.id),
    ["a1", "a2", "l1", "l2", "l3"],
  );
});

test("a local message written before any turn opens the thread", () => {
  const thread = interleave(
    [localMessage("l0", "coach", "Mình đang ngoại tuyến.", 0)],
    [agentMessage("a1", "user", "Chào")],
  );
  assert.deepEqual(
    thread.map((m) => m.id),
    ["l0", "a1"],
  );
});

test("a message the stream cannot place is kept at the end, not dropped", () => {
  // `after` can outrun the stream if the agent is reset mid-flight. Losing the
  // message would be worse than showing it last.
  const thread = interleave(
    [localMessage("l1", "coach", "Mình chưa trả lời được.", 9)],
    [agentMessage("a1", "assistant", "Chào bạn.")],
  );
  assert.deepEqual(
    thread.map((m) => m.id),
    ["a1", "l1"],
  );
});

test("a turn that flattens to nothing does not shift what follows it", () => {
  // `flatten` drops a message with no text and no pending question. The local
  // queue is drained against raw stream positions, so the drop must not move a
  // local message that was recorded after it.
  const empty = { id: "a2", role: "assistant" as const, parts: [] };
  const thread = interleave(
    [localMessage("l1", "coach", "Mình đang mất kết nối.", 2)],
    [agentMessage("a1", "user", "CV của mình ổn chưa?"), empty],
  );
  assert.deepEqual(
    thread.map((m) => m.id),
    ["a1", "l1"],
  );
});

// ── reasoning and the tool lifecycle ──────────────────────────────────────
//
// Built on lib/coach/fixture.ts, because every one of these states costs a
// fifty-second turn and real tokens to summon from a live model, and three of
// them cannot be summoned on demand at all.

test("reasoning is projected instead of thrown away", () => {
  const message = coachTurn(reasoning("Đang cân nhắc hai hướng."));
  const flat = flatten(message);
  assert.equal(flat?.reasoning?.text, "Đang cân nhắc hai hướng.");
  assert.equal(flat?.reasoning?.streaming, false);
});

test("a turn that has only started thinking still renders", () => {
  // The whole point: fifty seconds of reasoning used to project to null, so the
  // thread showed nothing at all while the model worked.
  const flat = flatten(coachTurn(reasoning("...", true)));
  assert.ok(flat, "a thinking turn must render");
  assert.equal(flat.reasoning?.streaming, true);
  assert.equal(flat.content, "");
});

test("streamed reasoning parts concatenate in order", () => {
  const flat = flatten(
    coachTurn(reasoning("Hồ sơ cho thấy "), reasoning("nền Marketing.", true)),
  );
  assert.equal(flat?.reasoning?.text, "Hồ sơ cho thấy nền Marketing.");
  assert.equal(flat?.reasoning?.streaming, true);
});

test("reasoning never leaks into the reply itself", () => {
  const flat = flatten(coachTurn(reasoning("thinking out loud"), text("Câu trả lời.")));
  assert.equal(flat?.content, "Câu trả lời.");
});

test("a tool call in flight is visible", () => {
  // `approval-requested` is deliberately not in this list; it has its own
  // state, because a call waiting on the user is not a call in progress.
  for (const state of [
    "input-streaming",
    "input-available",
    "approval-responded",
  ] as const) {
    const flat = flatten(coachTurn(toolPart(state)));
    assert.equal(flat?.tools?.[0].state, "running", `${state} should read as running`);
  }
});

test("a successful call reads its confirmation from the envelope", () => {
  const flat = flatten(coachTurn(toolPart("output-available")));
  assert.equal(flat?.tools?.[0].state, "done");
  assert.equal(flat?.tools?.[0].summary?.vi, "Đã thêm việc “học SQL”");
  assert.equal(flat?.tools?.[0].summary?.en, "Added “learn SQL”");
});

test("a payload the schema refused is a failure, not a success", () => {
  // The tool answers `ok: false` for bad input. That used to be dropped, so the
  // reply carried on saying it had added something while nothing had.
  const flat = flatten(
    coachTurn(
      toolPart("output-available", { error: "Invalid input for todo.add" }),
      text("Mình đã thêm việc đó vào danh sách của bạn."),
    ),
  );
  assert.equal(flat?.tools?.[0].state, "error");
  assert.equal(flat?.tools?.[0].errorText, "Invalid input for todo.add");
});

test("upstream failures and refusals are distinguished", () => {
  assert.equal(flatten(coachTurn(toolPart("output-error")))?.tools?.[0].state, "error");
  assert.equal(flatten(coachTurn(toolPart("output-denied")))?.tools?.[0].state, "denied");
});

test("appliedActions still means only what actually landed", () => {
  // Everything downstream of this rule depends on it: a confirmation appears if
  // and only if a change really happened.
  const message = coachTurn(
    toolPart("output-available"),
    toolPart("output-error"),
    toolPart("output-denied"),
    toolPart("input-available"),
  );
  assert.equal(appliedActions(message).length, 1);
  assert.equal(toolCalls(message).length, 4);
});

test("every scenario in the harness projects to something renderable", () => {
  // The harness is only useful if each case shows what it claims to show.
  for (const scenario of scenarios) {
    const rendered = scenario.messages.map(flatten).filter(Boolean);
    assert.equal(
      rendered.length,
      scenario.messages.length,
      `scenario "${scenario.id}" has a message that renders as nothing`,
    );
  }
});

test("a call parked on the user is not also reported as in progress", () => {
  // The approval card already says what is about to happen. A "making the
  // change…" chip beside it would contradict it, and on a deletion that is the
  // difference between "decide" and "too late".
  const flat = flatten(coachTurn(toolPart("approval-requested")));
  assert.equal(flat?.tools?.[0].state, "awaiting");
});

test("once approved, the call reads as in progress again", () => {
  const flat = flatten(coachTurn(toolPart("approval-responded")));
  assert.equal(flat?.tools?.[0].state, "running");
});
