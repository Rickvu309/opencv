import { test } from "node:test";
import assert from "node:assert/strict";

import { nextId } from "@/lib/ids";

test("nextId reads the highest suffix, not the length", () => {
  // Counting would reuse an id after a removal, and every edit action targets
  // an id: reuse means an edit aimed at a deleted entry lands on its successor.
  assert.equal(nextId("cv", ["cv-1", "cv-2"]), "cv-3");
  assert.equal(nextId("cv", ["cv-1", "cv-3"]), "cv-4");
  assert.equal(nextId("cv", []), "cv-1");
  assert.equal(nextId("cv", ["cv-other", "unrelated-9"]), "cv-1");
});
