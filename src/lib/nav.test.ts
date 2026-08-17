import { test } from "node:test";
import assert from "node:assert/strict";

import { destinationOf } from "./nav-destination";

test("a bare path clears the query", () => {
  assert.deepEqual(destinationOf("/paper"), { to: "/paper", search: {} });
});

test("a query string becomes a search object", () => {
  assert.deepEqual(destinationOf("/paper?id=x"), {
    to: "/paper",
    search: { id: "x" },
  });
});

test("an explicit search wins over the href query", () => {
  assert.deepEqual(destinationOf("/paper?id=x", { new: "cv" }), {
    to: "/paper",
    search: { new: "cv" },
  });
});
