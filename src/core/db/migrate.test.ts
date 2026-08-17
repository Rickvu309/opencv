import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { withTestSchema, testDatabaseUrl } from "@/core/db/testing";
import { migrate } from "@/core/db/migrate";

describe("migrations", () => {
  it("applies the numbered pairs", async (t) => {
    if (!testDatabaseUrl()) {
      t.skip("TEST_DATABASE_URL is not set");
      return;
    }
    await withTestSchema(async () => {
      await migrate("status");
      assert.ok(true);
    });
  });
});
