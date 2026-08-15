import { test } from "node:test";
import assert from "node:assert/strict";

import {
  defaultHandle,
  isHandle,
  loggedDays,
  slugifyHandle,
  snapshotOf,
} from "./share";
import type { ProofPaper } from "./types";

test("a handle is letters, numbers, and hyphens", () => {
  assert.equal(isHandle("mai-ab12cd"), true);
  assert.equal(isHandle("Mai"), false);
  assert.equal(isHandle("ab"), false);
  assert.equal(isHandle("-mai"), false);
});

test("the default handle is the name plus a short id", () => {
  assert.equal(
    defaultHandle("Lê Thu Hà", "abcdef12-3456-7890-abcd-ef1234567890"),
    "le-thu-ha-abcdef",
  );
  assert.equal(slugifyHandle(""), "you");
});

test("publishing stamps note days so the calendar has a record", () => {
  const paper: ProofPaper = {
    id: "paper-1",
    type: "proof",
    label: "Class project",
    language: "en",
    notes: [{ id: "n-1", text: "Built a dashboard", at: "Just now" }],
    updatedAt: "Just now",
  };
  const at = new Date("2026-08-15T10:00:00.000Z");
  const snapshot = snapshotOf(paper, at);
  assert.equal(snapshot.notes[0]?.at, "2026-08-15");
  assert.deepEqual(loggedDays([snapshot]), ["2026-08-15"]);
});
