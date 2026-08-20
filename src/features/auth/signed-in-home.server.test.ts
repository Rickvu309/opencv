import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { withTestSchema, testDatabaseUrl } from "@/core/db/testing";
import { executeCommand } from "@/core/commands/bus";
import { createUser } from "@/core/auth/store";
import { withClient } from "@/core/db/client.server";
import { loadSignedInHome } from "@/features/auth/signed-in-home.server";
import "@/features/register";

async function userId() {
  process.env.SESSION_SECRET ??= "test-session-secret-at-least-32-chars";
  return createUser(`u${Date.now()}@example.com`, "password12");
}

async function proofCount(id: string) {
  const { rows } = await withClient((c) =>
    c.query<{ n: string }>(`select count(*)::text as n from proofs where user_id=$1`, [id]),
  );
  return Number(rows[0]?.n ?? 0);
}

describe("loadSignedInHome", () => {
  it("mints a dump and opens the editor for an empty signed-in account", async (t) => {
    if (!testDatabaseUrl()) {
      t.skip("TEST_DATABASE_URL is not set");
      return;
    }
    await withTestSchema(async () => {
      const id = await userId();
      const dest = await loadSignedInHome(id, true);
      assert.equal(dest.to, "/proof/$proofId");
      assert.ok(dest.to === "/proof/$proofId" && dest.params.proofId);
      assert.equal(await proofCount(id), 1);
    });
  });

  it("opens the list when proofs already exist and does not mint another", async (t) => {
    if (!testDatabaseUrl()) {
      t.skip("TEST_DATABASE_URL is not set");
      return;
    }
    await withTestSchema(async () => {
      const id = await userId();
      await executeCommand("proof.create", { title: "Saturday close" }, { kind: "user", userId: id });
      const dest = await loadSignedInHome(id, true);
      assert.deepEqual(dest, { to: "/proof" });
      assert.equal(await proofCount(id), 1);
    });
  });

  it("opens onboarding without minting a dump", async (t) => {
    if (!testDatabaseUrl()) {
      t.skip("TEST_DATABASE_URL is not set");
      return;
    }
    await withTestSchema(async () => {
      const id = await userId();
      const dest = await loadSignedInHome(id, false);
      assert.deepEqual(dest, { to: "/onboarding" });
      assert.equal(await proofCount(id), 0);
    });
  });
});
