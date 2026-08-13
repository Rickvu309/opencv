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
  assert.deepEqual(state.resumes, []);
  assert.deepEqual(state.papers, []);
  assert.deepEqual(state.pitch, []);
});

test("an action reports which rows it touched, so the UI can flash them", () => {
  const before = populated();

  // Newly created rows report the id the reducer minted, which the caller
  // could not have known in advance.
  const added = applyAction(before, "pitch.write", {
    kind: "bio",
    body: "Sinh viên năm ba, đang hướng tới data analyst.",
  });
  assert.deepEqual(added.touched, [added.state.pitch[0].id]);

  // An action with nothing row-shaped to point at simply reports nothing.
  const context = applyAction(before, "profile.setContext", {
    label: "Địa điểm",
    value: "Hà Nội",
  });
  assert.deepEqual(context.touched, []);
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
  assert.equal(isDestructiveAction("profile.obliterate"), false);
  assert.equal(isDestructiveAction(""), false);
});

test("adding and editing stay automatic", () => {
  for (const name of [
    "profile.addCourse",
    "profile.setIdentity",
    "pitch.write",
    "resume.create",
  ]) {
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
