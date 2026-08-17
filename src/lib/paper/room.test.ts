import { test } from "node:test";
import assert from "node:assert/strict";

import { applyAction } from "@/lib/actions/registry";
import { seedState } from "@/lib/actions/seed";
import { paperHref, roomMode, shouldTravel } from "./room";

test("a deep link is Docs, not a Drive flash", () => {
  assert.equal(
    roomMode({ id: "paper-1", creating: null, format: false, openedType: "cv" }),
    "docs",
  );
  assert.equal(
    roomMode({ id: "paper-1", creating: null, format: false, openedType: null }),
    "docs",
  );
  assert.equal(
    roomMode({ id: null, creating: null, format: false }),
    "drive",
  );
});

test("opening a row travels; a land does not", () => {
  assert.equal(shouldTravel("open"), true);
  assert.equal(shouldTravel("back"), true);
  assert.equal(shouldTravel("land"), false);
});

test("New CV and Format reopen the gallery in the same room", () => {
  assert.equal(
    roomMode({ id: null, creating: "cv", format: false }),
    "gallery",
  );
  assert.equal(
    roomMode({
      id: "paper-1",
      creating: null,
      format: true,
      openedType: "cv",
    }),
    "gallery",
  );
  assert.equal(paperHref({ creating: "cv" }), "/paper?new=cv");
  assert.equal(
    paperHref({ id: "paper-1", format: true }),
    "/paper?id=paper-1&format=1",
  );
});

test("create and rename go through paper actions", () => {
  let state = applyAction(seedState(), "paper.create", {
    type: "cv",
    label: "Tonight",
    fromProfile: false,
  }).state;
  const id = state.paper[0]?.id;
  assert.ok(id);
  assert.equal(state.uploads.length, 0);
  state = applyAction(state, "paper.rename", { id, label: "CV, intern" }).state;
  assert.equal(state.paper.length, 1);
  assert.equal(state.paper[0]?.label, "CV, intern");
  assert.equal(paperHref({ id }), `/paper?id=${id}`);
});
