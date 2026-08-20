import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { withTestSchema, testDatabaseUrl } from "@/core/db/testing";
import { executeCommand } from "@/core/commands/bus";
import { createUser } from "@/core/auth/store";
import { loadAfterSignInHome } from "@/features/auth/signed-in-home.server";
import "@/features/register";

async function userId() {
  process.env.SESSION_SECRET ??= "test-session-secret-at-least-32-chars";
  return createUser(`u${Date.now()}@example.com`, "password12");
}

describe("loadAfterSignInHome", () => {
  it("opens dump for a completed onboarding skip with zero proofs", async (t) => {
    if (!testDatabaseUrl()) {
      t.skip("TEST_DATABASE_URL is not set");
      return;
    }
    await withTestSchema(async () => {
      const id = await userId();
      const dest = await loadAfterSignInHome(id);
      assert.equal(dest.to, "/proof/$proofId");
      assert.notEqual(dest.to, "/coach");
    });
  });

  it("reopens an empty proof minted before Skip, not the list", async (t) => {
    if (!testDatabaseUrl()) {
      t.skip("TEST_DATABASE_URL is not set");
      return;
    }
    await withTestSchema(async () => {
      const id = await userId();
      const created = await executeCommand<{ id: string }>(
        "proof.create",
        { title: "" },
        { kind: "user", userId: id },
      );
      const dest = await loadAfterSignInHome(id);
      assert.deepEqual(dest, { to: "/proof/$proofId", params: { proofId: created.result.id } });
    });
  });

  it("opens Paper when a proof has a real log", async (t) => {
    if (!testDatabaseUrl()) {
      t.skip("TEST_DATABASE_URL is not set");
      return;
    }
    await withTestSchema(async () => {
      const id = await userId();
      const created = await executeCommand<{ id: string }>(
        "proof.create",
        { title: "" },
        { kind: "user", userId: id },
      );
      await executeCommand(
        "proof.log",
        { proofId: created.result.id, body: "Saturday close." },
        { kind: "user", userId: id },
      );
      const dest = await loadAfterSignInHome(id);
      assert.deepEqual(dest, { to: "/paper" });
      assert.notEqual(dest.to, "/proof");
    });
  });
});
