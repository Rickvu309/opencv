// The instructions are the Coach's other half. A registry action the Coach has
// never been told about is an action that exists and never fires, and nothing
// in the type system notices: the tool description lists it, the model shrugs,
// and the feature quietly does not work.
//
// These tests cannot judge whether the writing is good. They can prove the
// Coach has been told each group of actions exists, and that the rules the
// requirements are explicit about are actually written down somewhere.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { actionNames } from "../lib/actions/registry";

const instructions = readFileSync(
  join(import.meta.dirname, "instructions.md"),
  "utf8",
);

/** "paper.create" and "paper.remove" are one group: `paper`. */
const groups = [...new Set(actionNames.map((name) => name.split(".")[0]))];

/**
 * The groups where knowing the action exists is not enough.
 *
 * Most of the registry needs no instruction: `todo.add` adds a task, the tool
 * description says so, and there is nothing else to know. These are
 * different, because using them well means following a rule the schema cannot
 * express, edit one line rather than the document, never invent a number,
 * never invent an experience. A group added here without a section is a
 * feature the Coach will use badly rather than not at all.
 */
const NEEDS_TEACHING = ["paper", "pitch"];

test("the groups that need a rule have one", () => {
  const untaught = NEEDS_TEACHING.filter((group) => !instructions.includes(`${group}.`));
  assert.deepEqual(
    untaught,
    [],
    "these action groups exist but the Coach has never been told how to use them",
  );
  // And the list itself is real, so a renamed group fails here rather than
  // passing silently.
  for (const group of NEEDS_TEACHING) {
    assert.ok(groups.includes(group), `${group} is not a group in the registry`);
  }
});

test("the drafting actions are named specifically, not just their group", () => {
  // The group check above passes as soon as one action is mentioned. These are
  // the ones a requirement turns on, so they are checked by name.
  for (const name of [
    "paper.create",
    "paper.updateEntry",
    "paper.updateParagraph",
    "paper.setBody",
    "pitch.write",
    "pitch.update",
  ]) {
    assert.ok(instructions.includes(name), `${name} is not in the instructions`);
  }
});

test("AC-PAPERS-004.3 and 005.3: the no-inventing rules are written down", () => {
  // Asking rather than inventing is the difference between a letter that helps
  // and one that gets found out in the interview. It is a model behaviour, so
  // the only thing to enforce here is that the rule was actually stated.
  assert.match(instructions, /do not invent|don't invent/i);
  assert.match(
    instructions,
    /do not invent a number/i,
    "the rule against inventing a measurable result is missing",
  );
});

test("AC-PITCH-002.3: the Coach is told to ask for the goal before drafting", () => {
  assert.match(instructions, /If they have not\s+set a goal, ask before you write/i);
});

test("AC-PITCH-003.4: the Coach is told never to invent an experience", () => {
  assert.match(instructions, /Never\s+invent an experience/i);
});

test("the granular edit is preferred over the whole-document rewrite", () => {
  // ADR-001 of the Document & CV Engine: a whole-document write is the one edit
  // that can silently delete work the user did between turns.
  const setBody = instructions.indexOf("paper.setBody");
  const updateParagraph = instructions.indexOf("paper.updateParagraph");
  assert.ok(updateParagraph > -1 && setBody > -1);
  assert.ok(
    updateParagraph < setBody,
    "the granular action should be taught before the one that replaces everything",
  );
});

test("the voice rules the whole product shares are still stated", () => {
  // A regression guard on edits to this file rather than a new rule: these are
  // the two the copy catalog also enforces, and an instruction file that lost
  // them would make the Coach the one part of the product with a different
  // voice.
  assert.match(instructions, /No exclamation marks/);
  assert.match(instructions, /second person/i);
});

test("AC-PITCH-004.3 and AC-PAPERS-009.2: a rewrite keeps the item's own language", () => {
  assert.match(
    instructions,
    /write in that item's own `language`/i,
  );
  assert.match(instructions, /follow the document's `language`/i);
});
