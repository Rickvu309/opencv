// The registry is the Coach's contract with the app, so it is the one part of
// the codebase worth testing directly: every tool call the agent makes lands
// here, and a silently wrong reducer would corrupt the user's data.
//
// The seed is empty, so these build their own state through `populated()`,
// which itself dispatches rather than hand-writing a state literal. See
// lib/actions/fixture.ts.
//
// Run with `npm test` (Node 24 strips the types; scripts/alias-hook.mjs teaches
// it the "@/" alias).

import { test } from "node:test";
import assert from "node:assert/strict";

import { populated } from "@/lib/actions/fixture";
import {
  actionNames,
  applyAction,
  destructiveActionNames,
  isDestructiveAction,
  lookupAction,
} from "@/lib/actions/registry";
import { seedState } from "@/lib/actions/seed";

test("a new account starts empty, not as somebody else", () => {
  const state = seedState();

  assert.equal(state.profile.identity.name, "");
  assert.equal(state.profile.identity.targetRole, "");
  assert.deepEqual(state.profile.experience, []);
  assert.deepEqual(state.profile.documents, []);
  assert.deepEqual(state.todos, []);
  assert.deepEqual(state.resumes, []);
  assert.equal(state.paths.targetId, null, "no goal until one is chosen");

  // Structure is seeded; content is not. The three stages are the shape of a
  // plan rather than anyone's plan.
  assert.equal(state.plan.stages.length, 3);
  assert.deepEqual(
    state.plan.stages.flatMap((s) => s.entries),
    [],
  );
});

test("todo.update amends a task without disturbing its identity", () => {
  const before = populated();
  const target = before.todos[0];

  const { state } = applyAction(before, "todo.update", {
    id: target.id,
    title: "Luyện SQL 30 phút mỗi ngày",
  });

  const after = state.todos.find((t) => t.id === target.id);
  assert.equal(after?.title, "Luyện SQL 30 phút mỗi ngày");
  // The point of amending rather than remove-then-add: these survive.
  assert.equal(after?.done, target.done);
  assert.equal(after?.source, target.source);
  assert.equal(state.todos.length, before.todos.length);
});

test("todo.add records who created the task", () => {
  const before = seedState();

  const byUser = applyAction(before, "todo.add", {
    title: "Tự thêm việc",
    source: "self",
  }).state;
  assert.equal(byUser.todos[0].source, "self");

  // The Coach is the default caller, so omitting it must still be attributable.
  const byCoach = applyAction(before, "todo.add", { title: "Coach thêm" }).state;
  assert.equal(byCoach.todos[0].source, "coach");
});

test("plan work is never copied into todos", () => {
  const state = populated();
  const planIds = new Set(
    state.plan.stages.flatMap((s) => s.entries.map((e) => e.id)),
  );
  const duplicated = state.todos.filter((t) => planIds.has(t.id));
  assert.deepEqual(
    duplicated,
    [],
    "a plan entry copied into todos gives it two done-states that cannot agree",
  );
});

test("todo.update leaves untouched fields alone", () => {
  const before = populated();
  const target = before.todos.find((t) => t.detail);
  assert.ok(target, "fixture should provide a todo with a detail");

  const { state } = applyAction(before, "todo.update", {
    id: target.id,
    title: "Tên mới",
  });

  assert.equal(state.todos.find((t) => t.id === target.id)?.detail, target.detail);
});

test("choosing a goal on the map becomes the plan's target role", () => {
  const before = seedState();

  const { state } = applyAction(before, "path.setTarget", { id: "business-analyst" });

  assert.equal(state.paths.targetId, "business-analyst");
  // The plan header reads identity.targetRole, so without this the user picks
  // a goal on the map and the roadmap keeps naming the old one.
  assert.equal(state.profile.identity.targetRole, "Business Analyst");
});

test("a goal added by the Coach can also be chosen", () => {
  const seeded = seedState();
  const added = applyAction(seeded, "path.addNode", {
    title: "Data Engineer",
    stage: "growth",
    fromId: "you",
  }).state;

  const { state } = applyAction(added, "path.setTarget", {
    id: added.paths.customNodes[0].id,
  });

  assert.equal(state.profile.identity.targetRole, "Data Engineer");
});

test("path.updateNode renames a node and keeps its edges", () => {
  const seeded = seedState();
  const added = applyAction(seeded, "path.addNode", {
    title: "Analytics Engineer",
    stage: "growth",
    fromId: "you",
  }).state;
  const node = added.paths.customNodes[0];

  const { state } = applyAction(added, "path.updateNode", {
    id: node.id,
    title: "Analytics Engineer (senior)",
    stage: "core",
  });

  const after = state.paths.customNodes[0];
  assert.equal(after.title, "Analytics Engineer (senior)");
  assert.equal(after.stage, "core");
  assert.equal(after.id, node.id, "the id must be stable or edges break");
  assert.deepEqual(
    state.paths.customEdges,
    added.paths.customEdges,
    "renaming must not orphan the node",
  );
});

test("path.updateNode rejects an empty title", () => {
  const seeded = seedState();
  assert.throws(() =>
    applyAction(seeded, "path.updateNode", { id: "custom-x", title: "" }),
  );
});

test("an action reports which rows it touched, so the UI can flash them", () => {
  const before = populated();
  const entry = before.plan.stages[0].entries[0];

  const toggled = applyAction(before, "plan.toggle", { id: entry.id });
  assert.deepEqual(toggled.touched, [entry.id]);

  // Newly created rows report the id the reducer minted, which the caller
  // could not have known in advance.
  const added = applyAction(before, "todo.add", { title: "Việc mới" });
  assert.deepEqual(added.touched, [added.state.todos[0].id]);

  // An action with nothing row-shaped to point at simply reports nothing.
  const context = applyAction(before, "profile.setContext", {
    label: "Địa điểm",
    value: "Hà Nội",
  });
  assert.deepEqual(context.touched, []);
});

test("unknown ids are a no-op, matching plan.updateEntry", () => {
  const before = populated();
  const { state } = applyAction(before, "todo.update", {
    id: "does-not-exist",
    title: "Không có thật",
  });
  assert.deepEqual(state.todos, before.todos);
});

// ── which actions have to ask first ───────────────────────────────────────
//
// The Coach applies changes on its own; that is the product. The exception is
// removal, because undo lives in a toast that leaves and the content does not
// come back. This classification is what agent/tools/apply_action.ts gates on,
// so a new action that forgets the flag silently becomes deletable-by-sentence.

test("every removal asks first", () => {
  const shouldAsk = actionNames.filter(
    (name) => name.endsWith(".remove") || /\.remove[A-Z]/.test(name),
  );
  const asking = shouldAsk.filter(isDestructiveAction);
  assert.deepEqual(
    shouldAsk.filter((n) => !asking.includes(n)),
    [],
    "these actions destroy something but apply without asking",
  );
  assert.ok(shouldAsk.length >= 9, `only found ${shouldAsk.length} removals`);
});

test("nothing else asks", () => {
  // The gate has to stay narrow. A confirmation on an ordinary edit is exactly
  // the friction the coach-first design exists to remove, and a product that
  // asks about everything trains people to click through without reading.
  const asking = destructiveActionNames.filter(
    (name) => !(name.endsWith(".remove") || /\.remove[A-Z]/.test(name)),
  );
  assert.deepEqual(asking, [], "these ask for confirmation but destroy nothing");
});

test("an unknown action is not treated as destructive", () => {
  // It cannot run either; answering true would put a confirmation dialogue in
  // front of a change that was never going to happen.
  assert.equal(isDestructiveAction("todo.obliterate"), false);
  assert.equal(isDestructiveAction(""), false);
});

test("adding and editing stay automatic", () => {
  for (const name of ["todo.add", "todo.update", "todo.toggle", "resume.create"]) {
    assert.equal(
      isDestructiveAction(name),
      false,
      `${name} must not need confirmation`,
    );
  }
});

test("every action that asks first has something to ask", () => {
  // eve's own prompt is "Approve tool call: apply_action", which names an
  // internal tool and not the thing about to be deleted. A destructive action
  // without its own sentence would show that to a student.
  const silent = destructiveActionNames.filter(
    (name) => !lookupAction(name)?.confirm,
  );
  assert.deepEqual(silent, [], "these delete something without saying what");
});

test("confirmations are questions, in both languages", () => {
  for (const name of destructiveActionNames) {
    const copy = lookupAction(name)!.confirm!({} as never);
    for (const locale of ["vi", "en"] as const) {
      assert.ok(copy[locale]?.length > 0, `${name} has no ${locale} confirmation`);
      assert.ok(
        copy[locale].includes("?"),
        `${name}'s ${locale} confirmation is not a question: ${copy[locale]}`,
      );
    }
    assert.notEqual(copy.vi, copy.en, `${name}'s confirmation was not translated`);
  }
});
