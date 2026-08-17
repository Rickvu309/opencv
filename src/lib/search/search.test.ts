// The parser turns somebody's clipboard into a row the fit calculator can
// score. It is best effort by design, so what these tests pin down is the part
// that must not be best effort: a requirement it cannot tie to a skill has to
// end up excluded rather than counted as failed.

import { test } from "node:test";
import assert from "node:assert/strict";

import { populated } from "@/lib/actions/fixture";
import { applyAction } from "@/lib/actions/registry";
import { seedState } from "@/lib/actions/seed";
import {
  fitProfileOf,
  hasProfileFacts,
  openingFit,
  rankOpenings,
} from "@/lib/search/fit";
import {
  excludesOpening,
  matchOpening,
  matchOpeningField,
  queryTokens,
} from "@/lib/search/match";
import { SEED_OPENINGS, parseOpening, savedOpenings } from "@/lib/search/types";

const POSTING = `Data Analyst Intern - Công ty ABC
Hà Nội, thực tập 3 tháng

Yêu cầu:
- SQL cơ bản, biết join và group by
- Thành thạo Excel
- Chủ động và ham học hỏi

Quyền lợi:
- Trợ cấp 5 triệu
https://example.com/jobs/da-intern`;

test("a pasted posting becomes an opening with its title, company and link", () => {
  const opening = parseOpening(POSTING);
  assert.ok(opening);
  assert.equal(opening.title, "Data Analyst Intern");
  assert.equal(opening.org, "Công ty ABC");
  assert.equal(opening.link, "https://example.com/jobs/da-intern");
});

test("only the requirements section becomes requirements", () => {
  // The benefits below it are not requirements, and counting "trợ cấp 5 triệu"
  // as something the user has to meet would make the fit read nonsense.
  const opening = parseOpening(POSTING);
  const labels = opening!.requirements.map((r) => r.label);
  assert.equal(labels.length, 3);
  assert.ok(labels.some((label) => label.includes("SQL")));
  assert.ok(!labels.some((label) => label.includes("Trợ cấp")));
});

test("AC-SEARCH-003.4: a requirement with no provable skill is excluded, not failed", () => {
  // "Chủ động và ham học hỏi" is a real requirement and terrible evidence.
  // Counting it as missing would cap everybody below full marks for a reason
  // they cannot act on.
  const opening = parseOpening(POSTING)!;
  const fit = openingFit(fitProfileOf(populated()), opening);
  assert.equal(fit.unprovable.length, 1);
  assert.equal(fit.total, 2, "the unprovable one is out of the denominator");
});

test("too little text is not an opening", () => {
  assert.equal(parseOpening("   "), null);
  assert.equal(parseOpening("xin chào"), null);
});

test("AC-SEARCH-003.2: fit is met over total, never an invented score", () => {
  const state = populated();
  const opening = parseOpening(POSTING)!;
  const fit = openingFit(fitProfileOf(state), opening);
  // The fixture has no SQL and no Excel, so nothing is met and both provable
  // requirements are missing. The point is that the numbers add up to the
  // requirements and to nothing else.
  assert.equal(fit.metCount + fit.missing.length, fit.total);
});

test("a met requirement is met because the profile evidences it", () => {
  const withSql = applyAction(populated(), "profile.addCourse", {
    name: "SQL cơ bản cho người mới",
  }).state;
  const opening = parseOpening(POSTING)!;
  const fit = openingFit(fitProfileOf(withSql), opening);
  assert.equal(fit.metCount, 1);
  assert.ok(fit.met[0].label.includes("SQL"));
});

test("AC-SEARCH-001.1: ranking puts the closest opening first", () => {
  const withSql = applyAction(populated(), "profile.addCourse", {
    name: "SQL nâng cao",
  }).state;
  const ranked = rankOpenings(fitProfileOf(withSql), SEED_OPENINGS);
  assert.equal(ranked.length, SEED_OPENINGS.length);
  const ratios = ranked.map((entry) =>
    entry.fit.total === 0 ? -1 : entry.fit.metCount / entry.fit.total,
  );
  assert.deepEqual(ratios, [...ratios].sort((a, b) => b - a));
});

test("an opening naming no readable requirement ranks last, not first", () => {
  // Zero over zero is an absence of information, not a perfect match. Sorting
  // it to the top would put the least informative postings in front.
  const vague = parseOpening("Chân dài tay dài\nCông ty X\n\nMô tả: liên hệ.")!;
  const ranked = rankOpenings(fitProfileOf(populated()), [vague, ...SEED_OPENINGS]);
  assert.equal(ranked.at(-1)?.opening.id, vague.id);
});

test("AC-SEARCH-001.2: an empty profile is not something to rank on", () => {
  assert.equal(hasProfileFacts(seedState()), false);
  assert.equal(hasProfileFacts(populated()), true);
});

test("AC-SEARCH-004.1: saving makes an opening available to applications", () => {
  const state = seedState();
  const saved = applyAction(state, "opening.save", {
    id: SEED_OPENINGS[0].id,
  }).state;
  assert.equal(savedOpenings(saved.openings).length, 1);

  const unsaved = applyAction(saved, "opening.unsave", {
    id: SEED_OPENINGS[0].id,
  }).state;
  assert.equal(savedOpenings(unsaved.openings).length, 0);
});

test("AC-SEARCH-004.2: removing an opening takes its application with it", () => {
  // A row that cannot say what it is an application to is not a record, it is
  // a puzzle.
  let state = applyAction(seedState(), "opening.save", {
    id: SEED_OPENINGS[0].id,
  }).state;
  state = applyAction(state, "application.create", {
    openingId: SEED_OPENINGS[0].id,
  }).state;
  assert.equal(state.applications.length, 1);

  state = applyAction(state, "opening.remove", { id: SEED_OPENINGS[0].id }).state;
  assert.equal(state.openings.length, SEED_OPENINGS.length - 1);
  assert.equal(state.applications.length, 0);
});

test("a pasted opening lands at the top of the user's own list", () => {
  const state = applyAction(seedState(), "opening.add", { text: POSTING }).state;
  assert.equal(state.openings.length, SEED_OPENINGS.length + 1);
  assert.equal(state.openings[0].title, "Data Analyst Intern");
  assert.equal(state.openings[0].seeded, undefined, "the user's own is not an example");
});

test("an empty query keeps every opening", () => {
  assert.ok(SEED_OPENINGS.every((opening) => matchOpening(opening, "")));
  assert.ok(SEED_OPENINGS.every((opening) => matchOpening(opening, "   ở   ")));
});

test("a city query hits location, not only the title", () => {
  const hanoi = SEED_OPENINGS.filter((opening) =>
    matchOpening(opening, "việc data ở Hà Nội"),
  );
  assert.ok(hanoi.some((opening) => opening.id === "seed-da-intern"));
  assert.ok(hanoi.every((opening) => opening.location === "Hanoi"));
  assert.ok(!hanoi.some((opening) => opening.id === "seed-ba-junior"));
});

test("a company or requirement query is not limited to the title", () => {
  const fintech = SEED_OPENINGS.filter((opening) =>
    matchOpening(opening, "công ty fintech"),
  );
  assert.deepEqual(
    fintech.map((opening) => opening.id),
    ["seed-de-junior"],
  );

  const sql = SEED_OPENINGS.filter((opening) => matchOpening(opening, "sql"));
  assert.ok(sql.length >= 3);
  assert.ok(sql.every((opening) =>
    opening.requirements.some((requirement) => requirement.skills.includes("sql")),
  ));
});

test("saved and example intents read the flags, not the posting text", () => {
  const saved = { ...SEED_OPENINGS[0], saved: true };
  assert.equal(matchOpening(saved, "tin đã lưu"), true);
  assert.equal(matchOpening(SEED_OPENINGS[0], "tin đã lưu"), false);
  assert.equal(matchOpening(SEED_OPENINGS[0], "tin ví dụ"), true);
  assert.equal(matchOpening({ ...SEED_OPENINGS[0], seeded: false }, "example"), false);
});

test("a title scope does not read the city field", () => {
  const hanoi = SEED_OPENINGS.filter((opening) =>
    matchOpeningField(opening, "Hà Nội", "title"),
  );
  assert.equal(hanoi.length, 0);
  const city = SEED_OPENINGS.filter((opening) =>
    matchOpeningField(opening, "Hà Nội", "city"),
  );
  assert.ok(city.every((opening) => opening.location === "Hanoi"));
});

test("exclude hides an opening that mentions any of the words", () => {
  const opening = SEED_OPENINGS.find((row) => row.id === "seed-de-junior")!;
  assert.equal(excludesOpening(opening, "fintech"), true);
  assert.equal(excludesOpening(opening, "fintech marketing"), true);
  assert.equal(excludesOpening(opening, "retail"), false);
  assert.equal(excludesOpening(opening, ""), false);
});

test("query tokens drop particles so a spoken phrase still matches", () => {
  assert.deepEqual(queryTokens("Việc data ở Hà Nội"), ["data", "ha", "noi"]);
});

test("the English starter phrases hit the seed set", () => {
  assert.ok(
    SEED_OPENINGS.some((opening) => matchOpening(opening, "Data jobs in Hanoi")),
  );
  assert.ok(
    SEED_OPENINGS.some((opening) => matchOpening(opening, "Analyst intern")),
  );
  assert.ok(
    SEED_OPENINGS.some((opening) => matchOpening(opening, "Fintech company")),
  );
  assert.equal(
    SEED_OPENINGS.some((opening) => matchOpening(opening, "Saved openings")),
    false,
  );
});

test("a new account starts with examples, marked as examples", () => {
  // The one thing seeded into a fresh account, and the reason it survives the
  // no-demo-persona rule: these are not this person's data pretending to be
  // theirs, and they say so.
  const state = seedState();
  assert.equal(state.openings.length, SEED_OPENINGS.length);
  assert.ok(state.openings.every((opening) => opening.seeded));
  assert.ok(state.openings.every((opening) => !opening.saved));
});
