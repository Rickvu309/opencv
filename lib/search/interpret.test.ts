import { test } from "node:test";
import assert from "node:assert/strict";

import { populated } from "@/lib/actions/fixture";
import { applyAction } from "@/lib/actions/registry";
import { fitProfileOf, openingFit, rankOpenings } from "@/lib/search/fit";
import {
  criteriaCount,
  filterCount,
  interpretQuery,
  matchesAsk,
  openingHasSkill,
  rankByAsk,
  serializeAsk,
  skillDisplayName,
  whyOpening,
} from "@/lib/search/interpret";
import { SEED_OPENINGS } from "@/lib/search/types";

test("a city-and-role ask becomes a city filter and a role, not a skill", () => {
  const ask = interpretQuery("Việc data ở Hà Nội", SEED_OPENINGS);
  assert.equal(ask.city, "Hanoi");
  assert.equal(ask.role.toLowerCase(), "data");
  assert.deepEqual(ask.criteria, []);
  assert.equal(ask.scope, "all");
  assert.equal(filterCount(ask), 2);
  assert.equal(criteriaCount(ask), 0);
});

test("a company ask becomes an org filter", () => {
  const ask = interpretQuery("Công ty fintech", SEED_OPENINGS);
  assert.equal(ask.org, "Fintech company");
  assert.equal(ask.role, "");
  assert.deepEqual(ask.criteria, []);
});

test("saved and example phrases become scope filters", () => {
  assert.equal(interpretQuery("Tin đã lưu", SEED_OPENINGS).scope, "saved");
  assert.equal(interpretQuery("tin ví dụ", SEED_OPENINGS).scope, "seeded");
  assert.equal(interpretQuery("saved openings", SEED_OPENINGS).scope, "saved");
});

test("skill words become criteria, not filters", () => {
  const ask = interpretQuery(
    "Data intern in Hanoi, Python and SQL",
    SEED_OPENINGS,
  );
  assert.equal(ask.city, "Hanoi");
  assert.match(ask.role.toLowerCase(), /data|intern/);
  assert.deepEqual([...ask.criteria].sort(), ["python", "sql"]);
});

test("filters exclude, criteria only rank", () => {
  const ask = interpretQuery("Hà Nội Python", SEED_OPENINGS);
  const matched = SEED_OPENINGS.filter((opening) => matchesAsk(opening, ask));
  assert.ok(matched.every((opening) => opening.location === "Hanoi"));
  assert.ok(
    matched.some((opening) => opening.id === "seed-mkt-analyst"),
    "Marketing Analyst in Hanoi stays in; Python does not exclude it",
  );
  assert.ok(matched.some((opening) => opening.id === "seed-de-junior"));
});

test("criteria put the posting that names them first", () => {
  const ask = interpretQuery("Python", SEED_OPENINGS);
  const ranked = rankByAsk(
    rankOpenings(fitProfileOf(populated()), SEED_OPENINGS),
    ask,
  );
  assert.equal(ranked[0]?.opening.id, "seed-de-junior");
  assert.ok(openingHasSkill(ranked[0]!.opening, "python"));
});

test("serialize then interpret keeps the structured fields", () => {
  const ask = interpretQuery(
    "Data intern in Hanoi, Python and SQL",
    SEED_OPENINGS,
  );
  const again = interpretQuery(serializeAsk(ask), SEED_OPENINGS);
  assert.equal(again.city, ask.city);
  assert.equal(again.scope, ask.scope);
  assert.deepEqual([...again.criteria].sort(), [...ask.criteria].sort());
  assert.ok(again.role.length > 0);
});

test("why a row matches cites the criteria it actually has", () => {
  const ask = interpretQuery("Python SQL", SEED_OPENINGS);
  const opening = SEED_OPENINGS.find((row) => row.id === "seed-de-junior")!;
  const withSql = applyAction(populated(), "profile.addCourse", {
    name: "Python cho phân tích",
  }).state;
  const fit = openingFit(fitProfileOf(withSql), opening);
  const why = whyOpening(opening, fit, ask);
  assert.ok(why.some((line) => line.kind === "criterion" && line.skill === "python"));
  assert.ok(why.some((line) => line.kind === "criterion" && line.skill === "sql"));
});

test("skill display names stay short and readable", () => {
  assert.equal(skillDisplayName("python"), "Python");
  assert.equal(skillDisplayName("sql"), "SQL");
  assert.equal(skillDisplayName("power bi"), "Power BI");
});
