// Fit is the most persuasive number in the product and it used to be a
// literal: `fit: 84` in the data, shown to someone who had entered nothing.
// These pin down that it now moves with the profile, in the direction a student
// would expect, and that it can explain itself.

import { test } from "node:test";
import assert from "node:assert/strict";

import { fitFor, matchRequirements, rankByFit, type FitProfile } from "@/lib/career-fit";
import { pathNodes } from "@/lib/catalogue";

const node = (id: string) => pathNodes.find((n) => n.id === id)!;

const empty: FitProfile = {
  education: { major: "", year: "", courses: [] },
  experience: [],
};

const profile = (over: Partial<FitProfile["education"]>, experience: FitProfile["experience"] = []): FitProfile => ({
  education: { major: "", year: "", courses: [], ...over },
  experience,
});

test("an empty profile does not score highly on anything", () => {
  // The bug this replaces: an empty profile was told it was an 84% fit.
  for (const n of pathNodes.filter((x) => x.requires?.length)) {
    const fit = fitFor(empty, n);
    assert.ok(
      fit.score < 60,
      `${n.id} scored ${fit.score}% for a profile with nothing in it`,
    );
  }
});

test("evidence moves the number", () => {
  const before = fitFor(empty, node("intern-da")).score;
  const after = fitFor(
    profile({ year: "Năm 3", courses: ["SQL cơ bản", "Excel nâng cao"] }),
    node("intern-da"),
  ).score;
  assert.ok(after > before, `expected a rise, got ${before} → ${after}`);
});

test("it says which requirements are met and which are not", () => {
  // A percentage a student cannot interrogate is worth very little.
  const fit = fitFor(
    profile({ courses: ["SQL cơ bản"] }),
    node("intern-da"),
  );
  assert.equal(fit.met.length, 1);
  assert.equal(fit.met[0].label, "SQL joins and aggregates");
  assert.equal(fit.missing.length, 2);
});

test("requirement match does not need a catalogue role", () => {
  const match = matchRequirements(profile({ courses: ["SQL"] }), {
    requires: [{ label: "SQL joins and aggregates", skills: ["sql"] }],
  });
  assert.equal(match.met.length, 1);
  assert.equal(match.missing.length, 0);
});

test("a skill is matched however it was typed", () => {
  // Accents, case and surrounding words all vary; the token is a substring of
  // the normalised text.
  for (const written of ["SQL", "sql cơ bản", "Advanced SQL joins", "Học SQL"]) {
    const fit = fitFor(profile({ courses: [written] }), node("intern-da"));
    assert.equal(fit.met.length, 1, `"${written}" should evidence SQL`);
  }
});

test("experience counts as evidence, not just courses", () => {
  const fit = fitFor(
    profile({}, [
      {
        title: "Thực tập phân tích",
        org: "ABC",
        detail: "Dựng dashboard bằng Power BI",
      },
    ]),
    node("data-analyst"),
  );
  assert.ok(
    fit.met.some((r) => r.label === "Telling a story with numbers"),
    "a dashboard in the experience detail should evidence storytelling",
  );
});

test("requirements no profile could prove are left out of the score", () => {
  // "Willingness to ask" is a real requirement and bad evidence. Counting it as
  // failed would cap everyone below a hundred for a reason they cannot act on.
  const marketing = node("intern-mkt");
  const fit = fitFor(profile({ courses: ["Excel"] }), marketing);
  assert.equal(fit.unprovable.length, 1);
  assert.equal(fit.unprovable[0].label, "Willingness to ask, and to keep at it");
  // One provable requirement, and it is met, so evidence is complete.
  assert.equal(fit.missing.length, 0);
});

test("an entry role outranks a senior one for a student", () => {
  const student = profile({ year: "Năm 2", courses: ["SQL"] });
  assert.ok(
    fitFor(student, node("intern-da")).score >
      fitFor(student, node("senior-da")).score,
    "a second-year should be closer to an internship than to a senior role",
  );
});

test("being past a stage is not a penalty", () => {
  // A graduate with experience is not a worse fit for an internship than a
  // second-year; they are just unlikely to want one.
  const graduate = profile({ year: "Đã tốt nghiệp", courses: ["SQL", "Excel"] }, [
    { title: "Data Intern", org: "X", detail: "SQL" },
  ]);
  const student = profile({ year: "Năm 2", courses: ["SQL", "Excel"] });
  assert.ok(
    fitFor(graduate, node("intern-da")).score >=
      fitFor(student, node("intern-da")).score,
  );
});

test("the year of study is read in either language", () => {
  // It is stored as its display string, in whichever language was on screen.
  const vi = profile({ year: "Đã tốt nghiệp" });
  const en = profile({ year: "Graduated" });
  assert.equal(
    fitFor(vi, node("data-analyst")).score,
    fitFor(en, node("data-analyst")).score,
  );
});

test("ranking puts the closest role first and excludes the origin", () => {
  const ranked = rankByFit(
    profile({ year: "Năm 3", courses: ["SQL", "Excel", "dự án phân tích"] }),
    pathNodes,
  );
  assert.ok(!ranked.some((r) => r.node.id === "you"), "the origin is not a role");
  assert.equal(ranked[0].node.id, "intern-da");
  for (let i = 1; i < ranked.length; i += 1) {
    assert.ok(ranked[i - 1].fit.score >= ranked[i].fit.score, "not sorted");
  }
});

test("every requirement carries tokens or is explicitly unprovable", () => {
  // The pairing is the whole design: prose and tokens in one object so an edit
  // to one cannot silently leave the other behind.
  for (const n of pathNodes) {
    for (const r of n.requires ?? []) {
      assert.ok(Array.isArray(r.skills), `${n.id} has a requirement with no skills array`);
      assert.ok(r.label, `${n.id} has a requirement missing a label`);
    }
  }
});

test("studying a subject is not the same as having done a project", () => {
  // Caught in the browser: a field of study of "Phân tích dữ liệu" ticked
  // "one analysis project of your own", because the token list for the project
  // included the word for analysis. Flattery of exactly the kind the hardcoded
  // score used to hand out.
  const student = profile({ major: "Phân tích dữ liệu" });
  const fit = fitFor(student, node("intern-da"));
  assert.ok(
    !fit.met.some((r) => r.label === "One analysis project of your own"),
    "a degree subject must not count as a personal project",
  );
});

test("an actual project does count", () => {
  const withProject = profile({ courses: ["Dự án phân tích doanh thu"] });
  const fit = fitFor(withProject, node("intern-da"));
  assert.ok(
    fit.met.some((r) => r.label === "One analysis project of your own"),
  );
});
