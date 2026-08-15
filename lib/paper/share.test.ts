import { test } from "node:test";
import assert from "node:assert/strict";

import {
  defaultHandle,
  isHandle,
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

test("a snapshot keeps the arranged notes and their kind", () => {
  const paper: ProofPaper = {
    id: "paper-1",
    type: "proof",
    label: "Class project",
    language: "en",
    why: "I wanted to see if the numbers held.",
    arrangeNoteIds: ["n-1", "n-3"],
    notes: [
      { id: "n-1", text: "Built a dashboard", at: "Just now" },
      { id: "n-2", text: "Left out", at: "Just now" },
      {
        id: "n-3",
        kind: "link",
        text: "Repo",
        url: "https://example.com",
        at: "Just now",
      },
    ],
    updatedAt: "Just now",
  };
  const at = new Date("2026-08-15T10:00:00.000Z");
  const snapshot = snapshotOf(paper, at, { name: "Hà" });
  assert.equal(snapshot.notes[0]?.at, "2026-08-15");
  assert.equal(snapshot.notes.length, 2);
  assert.equal(snapshot.notes[1]?.kind, "link");
  assert.equal(snapshot.notes[1]?.url, "https://example.com");
  assert.equal(snapshot.why, "I wanted to see if the numbers held.");
  assert.equal(snapshot.name, "Hà");
});
