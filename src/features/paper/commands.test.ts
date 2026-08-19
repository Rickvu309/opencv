import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { withTestSchema, testDatabaseUrl } from "@/core/db/testing";
import { executeCommand, undoCommand } from "@/core/commands/bus";
import { createUser } from "@/core/auth/store";
import { withClient } from "@/core/db/client.server";
import { paperContentSchema } from "@/features/paper/model";
import "@/features/register";

async function userActor() {
  process.env.SESSION_SECRET ??= "test-session-secret-at-least-32-chars";
  const userId = await createUser(`u${Date.now()}@example.com`, "password12");
  return { kind: "user" as const, userId };
}

describe("paper.updateBlock", () => {
  it("patches one block and undoes only that block", async (t) => {
    if (!testDatabaseUrl()) {
      t.skip("TEST_DATABASE_URL is not set");
      return;
    }
    await withTestSchema(async () => {
      const actor = await userActor();
      const created = await executeCommand<{ id: string }>(
        "paper.create",
        { kind: "cv", title: "Linh CV" },
        actor,
      );
      const id = created.result.id;
      await executeCommand("paper.updateBlock", { id, name: "Linh" }, actor);
      await executeCommand("paper.updateBlock", { id, contact: "Da Nang" }, actor);
      const named = await executeCommand("paper.updateBlock", { id, name: "An" }, actor);
      const after = await withClient((c) =>
        c.query(`select content from papers where id=$1`, [id]),
      );
      const content = paperContentSchema.parse(after.rows[0]?.content);
      assert.equal(content.name, "An");
      assert.equal(content.contact, "Da Nang");
      await undoCommand(named.id, actor);
      const undone = await withClient((c) =>
        c.query(`select content from papers where id=$1`, [id]),
      );
      const restored = paperContentSchema.parse(undone.rows[0]?.content);
      assert.equal(restored.name, "Linh");
      assert.equal(restored.contact, "Da Nang");
    });
  });
});
