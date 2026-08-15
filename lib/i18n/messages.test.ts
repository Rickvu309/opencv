// The catalog is the one file where a missing string is invisible until a
// user sees a blank button. These tests prove every leaf exists and is English.

import { test } from "node:test";
import assert from "node:assert/strict";

import { profileWeights, vaultItems } from "@/lib/profile/vault";
import { pathNodes, stages } from "@/lib/catalogue";
import { actions, actionNames } from "@/lib/actions/registry";
import { sectionDefaults } from "@/lib/paper/cv";
import { isLocale, locales, matchesMsg } from "@/lib/i18n/locale";
import { messages } from "@/lib/i18n/messages";

/** Every leaf of the catalog, with the path that reaches it. */
function* leaves(
  node: unknown,
  path = "",
): Generator<{ path: string; value: string }> {
  if (typeof node === "string") {
    yield { path, value: node };
    return;
  }
  if (typeof node !== "object" || node === null) return;
  const record = node as Record<string, unknown>;
  for (const [key, child] of Object.entries(record)) {
    const resolved =
      typeof child === "function"
        ? (child as (...args: unknown[]) => unknown)("X", 2, 3)
        : child;
    yield* leaves(resolved, path ? `${path}.${key}` : key);
  }
}

const catalog = [...leaves(messages)];

test("the catalog is not empty and every leaf has English", () => {
  assert.ok(catalog.length > 200, `only ${catalog.length} entries found`);

  for (const { path, value } of catalog) {
    const text = value;
    assert.equal(typeof text, "string", `${path} is not a string`);
    assert.ok(text.trim().length > 0, `${path} is empty`);
  }
});

test("nothing has grown back into a paragraph", () => {
  const budget = 18;
  const examples = new Set([
    "paper.cv.entryDetailPlaceholder",
    "onboarding.coursesPlaceholder",
  ]);

  const overlong = catalog
    .filter(({ path }) => !examples.has(path))
    .filter(
        ({ value }) => value.trim().split(/\s+/).length > budget,
    )
    .map(
      ({ path, value }) =>
        `${path} (${value.trim().split(/\s+/).length} words)`,
    );

  assert.deepEqual(overlong, [], "these entries are longer than they need to be");
});

test("no interface copy still carries Vietnamese", () => {
  const diacritics =
    /[àáâãèéêìíòóôõùúýăđĩũơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i;
  const leaked = catalog
    .filter(({ value }) => diacritics.test(value))
    .map(({ path }) => path);

  assert.deepEqual(leaked, [], "English entries still carrying Vietnamese text");
});

test("every action announces itself in English", () => {
  const stub = {
    title: "X",
    label: "X",
    name: "X",
    heading: "X",
    targetRole: "X",
    kind: "experience",
    language: "en",
  };

  for (const name of actionNames) {
    const summary = actions[name].summary(stub as never);
    assert.equal(typeof summary, "string", `${name} has no English summary`);
    assert.ok(summary.length > 0, `${name}'s English summary is empty`);
  }
});

test("the role catalogue reads in English", () => {
  for (const stage of stages) {
    assert.ok(stage.label, `stage ${stage.id} has no English label`);
    assert.ok(stage.horizon, `stage ${stage.id} has no English horizon`);
  }

  for (const node of pathNodes) {
    assert.ok(node.summary, `${node.id} has no English summary`);
    for (const line of node.does ?? []) {
      assert.ok(line, `${node.id} "does" is missing English`);
    }
    for (const requirement of node.requires ?? []) {
      assert.ok(requirement.label, `${node.id} "requires" is missing English`);
    }
  }
});

test("profile completeness still adds to 100 without CV files in the vault", () => {
  const vault = vaultItems.reduce((sum, item) => sum + item.weight, 0);
  const facts = Object.values(profileWeights).reduce((sum, item) => sum + item, 0);
  assert.equal(vault + facts, 100);
  assert.deepEqual(
    vaultItems.map((item) => item.id).sort(),
    ["github", "linkedin", "portfolio"],
  );
});

test("document kinds and CV sections read in English", () => {
  for (const item of vaultItems) {
    assert.ok(item.title, `${item.id} has no English title`);
    assert.ok(item.benefit, `${item.id} has no English benefit`);
    assert.ok(item.addLabel, `${item.id} has no English add label`);
    assert.ok(item.coachPrompt, `${item.id} has no English prompt`);
  }

  for (const [kind, entry] of Object.entries(sectionDefaults)) {
    assert.ok(entry.heading, `${kind} has no English heading`);
    assert.ok(entry.hint, `${kind} has no English hint`);
  }
});

test("the UI language is English", () => {
  assert.deepEqual(locales, ["en"]);
});

test("a stored label is recognised", () => {
  assert.ok(matchesMsg(messages.context.location, "Location"));
  assert.ok(matchesMsg(messages.context.location, "  location  "));
  assert.ok(!matchesMsg(messages.context.location, "Somewhere else"));
});

test("isLocale only accepts English", () => {
  assert.ok(isLocale("en"));
  assert.ok(!isLocale("vi"));
  assert.ok(!isLocale("fr"));
  assert.ok(!isLocale(""));
  assert.ok(!isLocale(undefined));
});
