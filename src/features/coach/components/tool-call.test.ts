import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { payloadText, queryFromInput, toolCallCopy } from "@/features/coach/components/tool-call";

describe("tool call helpers", () => {
  it("pairs a running verb with a settled verb", () => {
    assert.deepEqual(toolCallCopy("paper.create"), {
      activeLabel: "Adding paper",
      label: "Added paper",
    });
    assert.deepEqual(toolCallCopy("app.open"), {
      activeLabel: "Opening",
      label: "Opened",
    });
    assert.deepEqual(toolCallCopy("paper.sharpenLine"), {
      activeLabel: "Sharpening a line",
      label: "Sharpened a line",
    });
  });

  it("uses the call target as the query chip", () => {
    assert.equal(queryFromInput({ kind: "cv" }), "CV");
    assert.equal(queryFromInput({ place: "paper" }), "paper");
    assert.equal(queryFromInput({ title: "Draft persistence" }), "Draft persistence");
    assert.equal(queryFromInput(null), "");
  });

  it("stringifies payloads the way the disclosure shows them", () => {
    assert.equal(payloadText({ q: "composer" }), '{"q":"composer"}');
    assert.equal(payloadText("plain"), "plain");
    assert.equal(payloadText(undefined), "");
  });
});
