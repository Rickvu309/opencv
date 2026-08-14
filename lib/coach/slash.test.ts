import { test } from "node:test";
import assert from "node:assert/strict";

import { applySlash, filterBySlash, slashToken } from "./slash";

test("a trailing slash token is the query, including an empty one", () => {
  assert.deepEqual(slashToken("/"), { query: "", from: 0 });
  assert.deepEqual(slashToken("hello /cv"), { query: "cv", from: 6 });
  assert.equal(slashToken("hello"), null);
  assert.equal(slashToken("a/b"), null);
  assert.equal(slashToken("/cv more"), null);
});

test("filter is case-insensitive and empty query keeps every item", () => {
  const items = ["Tailor my CV", "Find openings"];
  assert.deepEqual(filterBySlash(items, ""), items);
  assert.deepEqual(filterBySlash(items, "cv"), ["Tailor my CV"]);
  assert.deepEqual(filterBySlash(items, "OPEN"), ["Find openings"]);
});

test("applySlash replaces from the slash to the end", () => {
  assert.equal(applySlash("/cv", 0, "Tailor my CV"), "Tailor my CV");
  assert.equal(applySlash("please /cv", 7, "Tailor my CV"), "please Tailor my CV");
});
