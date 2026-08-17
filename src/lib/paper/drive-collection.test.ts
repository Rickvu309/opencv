import { test } from "node:test";
import assert from "node:assert/strict";

import { applyAction } from "@/lib/actions/registry";
import { seedState } from "@/lib/actions/seed";
import { driveOf } from "./drive";
import { driveCollectionOf } from "./drive-collection";

test("Drive collection is a read-model of the same rows", () => {
  const state = applyAction(seedState(), "paper.create", {
    type: "cv",
    label: "Tonight",
    fromProfile: false,
  }).state;
  const { rows } = driveOf(state.paper, state.uploads);
  const collection = driveCollectionOf(rows);
  assert.equal(collection.size, rows.length);
  assert.equal([...collection.keys()][0], `paper:${rows[0]?.item.id}`);
});
