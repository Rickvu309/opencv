import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { withTestSchema, testDatabaseUrl } from "@/core/db/testing";
import { executeCommand } from "@/core/commands/bus";
import { createUser } from "@/core/auth/store";
import { withClient } from "@/core/db/client.server";
import "@/features/register";

async function userActor() {
  process.env.SESSION_SECRET ??= "test-session-secret-at-least-32-chars";
  const userId = await createUser(`u${Date.now()}@example.com`, "password12");
  return { kind: "user" as const, userId };
}

describe("conversation and app.open", () => {
  it("starts, renames, and removes a conversation", async (t) => {
    if (!testDatabaseUrl()) {
      t.skip("TEST_DATABASE_URL is not set");
      return;
    }
    await withTestSchema(async () => {
      const actor = await userActor();
      const started = await executeCommand<{ id: string }>(
        "conversation.start",
        { title: "First thread" },
        actor,
      );
      assert.ok(started.id);
      const renamed = await executeCommand("conversation.rename", {
        id: started.result.id,
        title: "Renamed thread",
      }, actor);
      assert.ok(renamed.id);
      const { rows } = await withClient((c) =>
        c.query(`select title from conversations where id=$1`, [started.result.id]),
      );
      assert.equal(rows[0].title, "Renamed thread");
      await executeCommand("conversation.remove", { id: started.result.id }, actor);
      const gone = await withClient((c) =>
        c.query(`select id from conversations where id=$1`, [started.result.id]),
      );
      assert.equal(gone.rows.length, 0);
    });
  });

  it("logs app.open and rejects a foreign paper", async (t) => {
    if (!testDatabaseUrl()) {
      t.skip("TEST_DATABASE_URL is not set");
      return;
    }
    await withTestSchema(async () => {
      const actor = await userActor();
      const opened = await executeCommand<{ ok: boolean; place: string }>(
        "app.open",
        { place: "paper" },
        actor,
      );
      assert.equal(opened.result.ok, true);
      assert.equal(opened.result.place, "paper");
      const { rows } = await withClient((c) =>
        c.query(`select name, inverse from command_log where id=$1`, [opened.id]),
      );
      assert.equal(rows[0].name, "app.open");
      assert.equal(rows[0].inverse, null);

      const missing = await executeCommand<{ ok: boolean; error?: string }>(
        "app.open",
        { place: "paper", paperId: "not-a-paper" },
        actor,
      );
      assert.equal(missing.result.ok, false);
      assert.match(missing.result.error ?? "", /not here/);
    });
  });
});
