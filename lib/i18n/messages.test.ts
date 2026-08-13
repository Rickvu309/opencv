// The catalog is the one file where a mistake is invisible until a user in the
// other language sees it. These tests are the cheap guard: they cannot judge
// whether the English is good, but they can prove it exists, that it is not a
// copy of the Vietnamese, and that nothing in the app is still a bare string.

import { test } from "node:test";
import assert from "node:assert/strict";

import { vaultItems } from "@/lib/catalog";
import { pathEdges, pathNodes, stages } from "@/lib/career-graph";
import { actions, actionNames } from "@/lib/actions/registry";
import { sectionDefaults } from "@/lib/cv/types";
import {
  isLocale,
  locales,
  looksVietnamese,
  matchesMsg,
  preferredLocale,
} from "@/lib/i18n/locale";
import { messages } from "@/lib/i18n/messages";

/** Every leaf of the catalog, with the path that reaches it. */
function* leaves(
  node: unknown,
  path = "",
): Generator<{ path: string; value: Record<string, unknown> }> {
  if (typeof node !== "object" || node === null) return;
  const record = node as Record<string, unknown>;
  if ("vi" in record && "en" in record) {
    yield { path, value: record };
    return;
  }
  for (const [key, child] of Object.entries(record)) {
    // Entries that take a value are functions; call them with a placeholder so
    // the pair they build is checked like any other.
    const resolved =
      typeof child === "function"
        ? (child as (...args: unknown[]) => unknown)("X", 2, 3)
        : child;
    yield* leaves(resolved, path ? `${path}.${key}` : key);
  }
}

const catalog = [...leaves(messages)];

test("the catalog is not empty and every leaf is a real pair", () => {
  assert.ok(catalog.length > 200, `only ${catalog.length} entries found`);

  for (const { path, value } of catalog) {
    for (const locale of locales) {
      const text = value[locale];
      assert.equal(typeof text, "string", `${path}.${locale} is not a string`);
      assert.ok(
        (text as string).trim().length > 0,
        `${path}.${locale} is empty`,
      );
    }
  }
});

test("English is written, not left as the Vietnamese", () => {
  // A handful of entries are legitimately identical in both: proper nouns, and
  // the language switch that confirms itself in the language being switched to.
  const sameByDesign = new Set([
    "nav.coach",
    "nav.cv",
    "cv.exportMarkdown",
    "cv.cvNamePlaceholder",
    "cv.forRole",
    "cv.untitled",
    "cv.entryPeriodPlaceholder",
    "coach.email",
    "cv.headerEmail",
    // A proper noun: the course is called this in both languages.
    "profile.certificatePlaceholder",
    "plan.stageProgress",
    "todo.sourceCoach",
    "onboarding.gpa",
    "waitlist.emailPlaceholder",
    "profile.versionCount",
    // A job title, written the same way on a Vietnamese posting and an
    // English one.
    "papers.targetRolePlaceholder",
  ]);

  const untranslated = catalog
    .filter(({ path, value }) => value.vi === value.en && !sameByDesign.has(path))
    .map(({ path }) => path);

  assert.deepEqual(
    untranslated,
    [],
    "these entries have the same text in both languages, which usually means " +
      "the English was never written",
  );
});

test("nothing has grown back into a paragraph", () => {
  // Interface copy earns its length. This is a ratchet, not a style opinion:
  // the catalog was written once and will be edited by whoever is in a hurry,
  // and long copy arrives one clause at a time.
  //
  // Separate budgets because the two languages count differently. Vietnamese
  // writes syllables as separate words, so the same sentence is roughly half as
  // long again in word count while being no longer to read.
  const budget = { vi: 26, en: 18 };

  // Placeholders that teach by example. A good CV bullet is the thing being
  // demonstrated, so shortening it would defeat the field it sits under.
  const examples = new Set([
    "cv.entryDetailPlaceholder",
    "onboarding.coursesPlaceholder",
  ]);

  const overlong = catalog
    .filter(({ path }) => !examples.has(path))
    .flatMap(({ path, value }) =>
      locales
        .filter((l) => (value[l] as string).trim().split(/\s+/).length > budget[l])
        .map((l) => `${path}.${l} (${(value[l] as string).trim().split(/\s+/).length} words)`),
    );

  assert.deepEqual(overlong, [], "these entries are longer than they need to be");
});

test("no interface copy is left in Vietnamese only", () => {
  // Vietnamese is the only language here with diacritics, so a Vietnamese
  // character in an English string is the signal that a pair was half-filled.
  const diacritics = /[àáâãèéêìíòóôõùúýăđĩũơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i;
  const leaked = catalog
    .filter(({ value }) => diacritics.test(value.en as string))
    .map(({ path }) => path);

  assert.deepEqual(leaked, [], "English entries still carrying Vietnamese text");
});

test("every action announces itself in both languages", () => {
  // The toast after an edit is the most-read sentence in the product. A missing
  // half here means the app silently answers in the wrong language.
  // A stub carrying every field any summary interpolates. Summaries are pure
  // and read only their input, so one stub exercises all forty.
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
    for (const locale of locales) {
      assert.equal(
        typeof summary[locale],
        "string",
        `${name} has no ${locale} summary`,
      );
      assert.ok(summary[locale].length > 0, `${name}'s ${locale} summary is empty`);
    }
  }
});

test("the career map reads in both languages", () => {
  for (const stage of stages) {
    for (const locale of locales) {
      assert.ok(stage.label[locale], `stage ${stage.id} has no ${locale} label`);
      assert.ok(stage.horizon[locale], `stage ${stage.id} has no ${locale} horizon`);
    }
  }

  for (const node of pathNodes) {
    for (const locale of locales) {
      assert.ok(node.summary[locale], `${node.id} has no ${locale} summary`);
      for (const line of node.does ?? []) {
        assert.ok(line[locale], `${node.id} "does" is missing ${locale}`);
      }
      for (const requirement of node.requires ?? []) {
        assert.ok(
          requirement.label[locale],
          `${node.id} "requires" is missing ${locale}`,
        );
      }
    }
  }

  // Every edge carries its condition; an edge without one is a route the map
  // draws but cannot explain.
  for (const edge of pathEdges) {
    assert.ok(edge.via, `${edge.from}->${edge.to} has no condition`);
    for (const locale of locales) {
      assert.ok(
        edge.via?.[locale],
        `${edge.from}->${edge.to} is missing its ${locale} condition`,
      );
    }
  }
});

test("document kinds and CV sections read in both languages", () => {
  for (const item of vaultItems) {
    for (const locale of locales) {
      assert.ok(item.title[locale], `${item.id} has no ${locale} title`);
      assert.ok(item.benefit[locale], `${item.id} has no ${locale} benefit`);
      assert.ok(item.addLabel[locale], `${item.id} has no ${locale} add label`);
      assert.ok(item.coachPrompt[locale], `${item.id} has no ${locale} prompt`);
    }
  }

  for (const [kind, entry] of Object.entries(sectionDefaults)) {
    for (const locale of locales) {
      assert.ok(entry.heading[locale], `${kind} has no ${locale} heading`);
      assert.ok(entry.hint[locale], `${kind} has no ${locale} hint`);
    }
  }
});

test("the browser's language is honoured, with Vietnamese as the default", () => {
  assert.equal(preferredLocale(["en-GB", "vi"]), "en");
  assert.equal(preferredLocale(["vi-VN"]), "vi");
  // An unconfigured or unrecognised browser gets Vietnamese: this product is
  // for Vietnamese early-career users, so that is the better guess.
  assert.equal(preferredLocale(["fr", "de"]), "vi");
  assert.equal(preferredLocale([]), "vi");
  assert.equal(preferredLocale(undefined), "vi");
});

test("a stored label is recognised whichever language wrote it", () => {
  // Context rows are keyed by their label, and the label was written in
  // whichever language the user was reading at the time.
  assert.ok(matchesMsg(messages.context.location, "Địa điểm"));
  assert.ok(matchesMsg(messages.context.location, "Location"));
  assert.ok(matchesMsg(messages.context.location, "  location  "));
  assert.ok(!matchesMsg(messages.context.location, "Nơi ở"));
});

test("isLocale rejects anything that is not one of the two", () => {
  assert.ok(isLocale("vi"));
  assert.ok(isLocale("en"));
  assert.ok(!isLocale("fr"));
  assert.ok(!isLocale(""));
  assert.ok(!isLocale(undefined));
});

// ── looksVietnamese ───────────────────────────────────────────────────────
//
// This decides whether to rewrite the whole interface under someone mid
// sentence, so its false positives are expensive and its false negatives are
// merely a missed convenience. It is built to fail in the cheap direction.

test("real Vietnamese questions are recognised", () => {
  const written = [
    "Chào bạn",
    "Mình nên ưu tiên gì trong 2 tuần tới?",
    "Hồ sơ của mình còn thiếu gì?",
    "Thêm giúp mình việc cần làm: học SQL cơ bản",
    "Cảm ơn nhiều",
    "Mình học Marketing năm 3, muốn làm Data Analyst",
    "Đánh dấu việc này là xong",
  ];
  for (const text of written) {
    assert.ok(looksVietnamese(text), `should read as Vietnamese: ${text}`);
  }
});

test("English is never mistaken for Vietnamese", () => {
  const written = [
    "What should I focus on over the next two weeks?",
    "Build me a CV from my profile",
    "Add a task: learn basic SQL this week",
    // The reason this is not a plain "any diacritic" check. Both are ordinary
    // words in an English conversation about careers, and flipping the whole
    // interface to Vietnamese for writing "résumé" is worse than never
    // flipping it at all.
    "Please review my résumé",
    "I work from a café most days",
    "Data Analyst, dashboard, portfolio",
  ];
  for (const text of written) {
    assert.ok(!looksVietnamese(text), `should not read as Vietnamese: ${text}`);
  }
});

test("Vietnamese typed without diacritics is not claimed either way", () => {
  // Absence is not evidence: plenty of people type "minh nen lam gi" and mean
  // Vietnamese. The rule is that a false here must never be read as "English",
  // which is why nothing ever auto-switches *to* English.
  assert.equal(looksVietnamese("minh nen lam gi"), false);
});
