import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { env } from "@/core/config/env";
import { hasExclamation } from "@/core/ai/guardrails";
import { storyUsesOnlyLog } from "@/features/proof/ai.server";

describe("coach evals", () => {
  it("skips golden conversations without an API key", (t) => {
    if (!env("OPENROUTER_API_KEY")) {
      t.skip("OPENROUTER_API_KEY is not set");
      return;
    }
    assert.equal(hasExclamation("Ask one next step."), false);
  });
});

describe("arranger grounding", () => {
  it("allows only facts present in the log", () => {
    const log = "ran a campus fair and clubs came back the next year";
    assert.equal(
      storyUsesOnlyLog(
        { what: "ran a campus fair", did: "set tables", came: "clubs came back the next year" },
        log,
      ),
      true,
    );
    assert.equal(
      storyUsesOnlyLog(
        { what: "ran a campus fair", did: "set tables", came: "cut time by 40%" },
        log,
      ),
      false,
    );
  });
});
