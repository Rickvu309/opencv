import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DUMP_PLACEHOLDER } from "@/features/proof/model";

describe("dump placeholder", () => {
  it("keeps the café invite and seeds one Saturday-close ghost", () => {
    assert.match(DUMP_PLACEHOLDER, /A café shift counts\. Write it like a text\./);
    assert.match(DUMP_PLACEHOLDER, /Saturday close/);
    assert.match(DUMP_PLACEHOLDER, /oat milk/);
    assert.match(DUMP_PLACEHOLDER, /last table/);
  });
});
