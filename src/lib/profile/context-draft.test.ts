import { test } from "node:test";
import assert from "node:assert/strict";

import { messages } from "@/lib/i18n/messages";
import { contextDraft, filledContextRows } from "./context-draft";

test("an empty situation opens on the four known fields", () => {
  assert.deepEqual(contextDraft([]), [
    { label: "Gender", value: "" },
    { label: "Year of birth", value: "" },
    { label: "How settled on the goal", value: "" },
    { label: "Location", value: "" },
  ]);
});

test("a stored label is kept as written", () => {
  const draft = contextDraft([{ label: "Location", value: "Hanoi" }]);
  const location = draft.find((row) => row.value === "Hanoi");
  assert.equal(location?.label, "Location");
  assert.equal(
    draft.filter((row) => row.label === messages.context.location).length,
    1,
  );
});

test("custom rows sit after the known fields and empty values are not kept", () => {
  const draft = contextDraft(
    [
      { label: "Location", value: "Hanoi" },
      { label: "Internship window", value: "Jun–Aug" },
      { label: "Gender", value: "  " },
    ],
  );
  assert.equal(draft.at(-1)?.label, "Internship window");
  assert.deepEqual(filledContextRows(draft), [
    { label: "Location", value: "Hanoi" },
    { label: "Internship window", value: "Jun–Aug" },
  ]);
});
