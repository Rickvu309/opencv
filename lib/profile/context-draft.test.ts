import { test } from "node:test";
import assert from "node:assert/strict";

import { messages } from "@/lib/i18n/messages";
import { contextDraft, filledContextRows } from "./context-draft";

test("an empty situation opens on the four known fields, in the reader's language", () => {
  assert.deepEqual(contextDraft([], "vi"), [
    { label: "Giới tính", value: "" },
    { label: "Năm sinh", value: "" },
    { label: "Mức độ chắc chắn về mục tiêu", value: "" },
    { label: "Địa điểm", value: "" },
  ]);
  assert.equal(contextDraft([], "en")[3]?.label, "Location");
});

test("a stored English label is the same row after the interface switches to Vietnamese", () => {
  const draft = contextDraft([{ label: "Location", value: "Hanoi" }], "vi");
  const location = draft.find((row) => row.value === "Hanoi");
  assert.equal(location?.label, "Location");
  assert.equal(draft.filter((row) => row.label === messages.context.location.vi).length, 0);
});

test("custom rows sit after the known fields and empty values are not kept", () => {
  const draft = contextDraft(
    [
      { label: "Location", value: "Hanoi" },
      { label: "Internship window", value: "Jun–Aug" },
      { label: "Gender", value: "  " },
    ],
    "en",
  );
  assert.equal(draft.at(-1)?.label, "Internship window");
  assert.deepEqual(filledContextRows(draft), [
    { label: "Location", value: "Hanoi" },
    { label: "Internship window", value: "Jun–Aug" },
  ]);
});
