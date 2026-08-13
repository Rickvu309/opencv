// The two halves of the Coach's loop, tested where they are pure.
//
// The React side (attaching context to a turn, reading the tool envelope off
// the stream) needs a model that answers and is verified there. What is
// testable without one is the contract each side depends on: that the context
// carries the ids the Coach needs to act, and that an envelope arriving from a
// model turn cannot dispatch something the registry does not know.

import { test } from "node:test";
import assert from "node:assert/strict";

import { coachContext } from "@/lib/actions/context";
import { populated } from "@/lib/actions/fixture";
import { applyAction, isActionName } from "@/lib/actions/registry";
import { seedState } from "@/lib/actions/seed";

test("context carries the ids the Coach needs to act on", () => {
  const state = populated();
  const ctx = coachContext(state, "/todo");

  assert.equal(ctx.route, "/todo");
  assert.ok(ctx.availableActions.includes("todo.toggle"));

  // A context that described the user's todos without their ids would let the
  // Coach discuss a task it has no way to toggle.
  const todo = ctx.state.todos[0];
  assert.ok(todo?.id, "todos must carry ids");
  const { state: after } = applyAction(state, "todo.toggle", { id: todo.id });
  assert.notEqual(after.todos[0].done, state.todos[0].done);
});

test("the Coach is told it can build a CV", () => {
  const ctx = coachContext(seedState(), "/cv");
  // The catalog in the tool description is what the model reads to decide; if
  // these fall out of the registry the Coach can describe a CV it cannot make.
  const offered = new Set<string>(ctx.availableActions);
  for (const name of ["resume.create", "resume.addEntry", "resume.updateEntry"]) {
    assert.ok(offered.has(name), `${name} must be offered`);
  }
});

test("context stays inside the per-turn budget it claims", () => {
  // The decision to send the whole state rests on this number. If it stops
  // holding, `context.ts` says to slice, and this is the test that says when.
  // Measured against a filled-in account with a CV, not an empty one, or the
  // budget is checked against the cheapest state the app ever holds.
  const state = applyAction(populated(), "resume.create", {
    label: "CV, Data Analyst",
  }).state;
  const bytes = JSON.stringify(coachContext(state, "/coach")).length;
  assert.ok(bytes < 10_000, `context is ${bytes} bytes, over the 10KB budget`);
});

test("isActionName accepts real actions and rejects everything else", () => {
  assert.ok(isActionName("todo.add"));
  assert.ok(isActionName("path.setTarget"));
  assert.ok(!isActionName("todo.destroyEverything"));
  assert.ok(!isActionName(""));
});

test("isActionName rejects inherited object keys", () => {
  // The name arrives as a string from a model turn, so a plain `in` check would
  // let "constructor" or "toString" through and index something that is not an
  // action. `Object.hasOwn` is the reason this passes.
  for (const key of ["toString", "constructor", "valueOf", "__proto__"]) {
    assert.ok(!isActionName(key), `${key} must not resolve to an action`);
  }
});

test("a well-formed envelope applies; a malformed one is rejected before dispatch", () => {
  const state = seedState();

  // What apply_action returns on success, replayed through the client's guard.
  const envelope = { ok: true, action: "todo.add", input: { title: "Ôn SQL" } };
  assert.ok(envelope.ok && isActionName(envelope.action));
  const { state: after, summary } = applyAction(
    state,
    envelope.action,
    envelope.input,
  );
  assert.equal(after.todos.length, state.todos.length + 1);
  // Announceable in both languages: a toast that falls back to the other one
  // is the language setting failing in the most visible place there is.
  assert.ok(summary.vi.length > 0, "every applied edit must be announceable in Vietnamese");
  assert.ok(summary.en.length > 0, "every applied edit must be announceable in English");

  // A payload that passed the model but not the schema must throw here rather
  // than half-applying: applyAction parses before it reduces.
  assert.throws(() => applyAction(state, "todo.toggle", { id: 42 }));
});
