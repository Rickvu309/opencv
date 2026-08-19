import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatElapsed, stepsFromReasoning } from "@/features/coach/components/reasoning";

describe("reasoning panel helpers", () => {
  it("splits double-newline blocks into titled steps", () => {
    const steps = stepsFromReasoning("I am checking the profile.\n\nThen I will draft a CV.");
    assert.deepEqual(steps, [
      { title: "I am checking the profile.", body: "" },
      { title: "Then I will draft a CV.", body: "" },
    ]);
  });

  it("uses the first line as the title when a block has a body", () => {
    const steps = stepsFromReasoning("Reading the request\nThe composer state has to move.");
    assert.deepEqual(steps, [
      { title: "Reading the request", body: "The composer state has to move." },
    ]);
  });

  it("formats elapsed seconds the way the trigger shows them", () => {
    assert.equal(formatElapsed(4), "4s");
    assert.equal(formatElapsed(60), "1m");
    assert.equal(formatElapsed(68), "1m 8s");
  });
});
