// The browser posts traces, and the browser is not a thing the server trusts.
// A malformed row would be stored once and break the reader on every read
// afterwards, so the shape check is what stands between the two.

import { test } from "node:test";
import assert from "node:assert/strict";

import { newCollector } from "@/lib/trace/collector";
import { isOutcome, looksLikeSpan, looksLikeTrace } from "@/lib/trace/types";

test("a real trace passes", () => {
  const collector = newCollector();
  collector.span({ name: "tool:x", kind: "tool", startedAt: Date.now() });
  assert.equal(looksLikeTrace(collector.finish()), true);
});

test("things that are not traces are refused", () => {
  for (const value of [null, undefined, 42, "trace", [], {}]) {
    assert.equal(looksLikeTrace(value), false, `accepted ${JSON.stringify(value)}`);
  }
});

test("a trace with a bad span is refused whole", () => {
  // Not partly stored. Half a trace is a lie about what happened.
  const trace = newCollector().finish();
  assert.equal(
    looksLikeTrace({ ...trace, spans: [{ id: "x", name: "y" }] }),
    false,
  );
});

test("a made-up span kind is refused", () => {
  assert.equal(
    looksLikeSpan({
      id: "1",
      name: "n",
      kind: "database",
      startedAt: 0,
      endedAt: 1,
      status: "ok",
    }),
    false,
  );
});

test("a made-up outcome is refused", () => {
  // Otherwise the column becomes a free-text field and every reader has to
  // guess what the values mean.
  assert.equal(isOutcome("applied"), true);
  assert.equal(isOutcome("accepted"), false);
  assert.equal(isOutcome(null), false);
});
