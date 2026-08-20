import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { withTestSchema, testDatabaseUrl } from "@/core/db/testing";
import { executeCommand } from "@/core/commands/bus";
import { createUser } from "@/core/auth/store";
import { withClient } from "@/core/db/client.server";
import { loadPaperCanvas } from "@/features/paper/load.server";
import { proofPageContentSchema } from "@/features/proof/model";
import "@/features/register";

const SATURDAY_CLOSE =
  "Saturday close. We ran out of oat milk and I stayed until the last table left.";

async function userActor() {
  process.env.SESSION_SECRET ??= "test-session-secret-at-least-32-chars";
  const userId = await createUser(`u${Date.now()}@example.com`, "password12");
  return { kind: "user" as const, userId };
}

describe("Paper canvas", () => {
  it("empty Paper is a dashed A4", async (t) => {
    if (!testDatabaseUrl()) {
      t.skip("TEST_DATABASE_URL is not set");
      return;
    }
    await withTestSchema(async () => {
      const actor = await userActor();
      const canvas = await loadPaperCanvas(actor.userId);
      assert.equal(canvas.kind, "dashed");
    });
  });

  it("puts a published Proof on the page in the same words as /p/:slug", async (t) => {
    if (!testDatabaseUrl()) {
      t.skip("TEST_DATABASE_URL is not set");
      return;
    }
    await withTestSchema(async () => {
      const actor = await userActor();
      const created = await executeCommand<{ id: string }>(
        "proof.create",
        { title: "" },
        actor,
      );
      const id = created.result.id;
      await executeCommand("proof.log", { proofId: id, body: SATURDAY_CLOSE }, actor);
      await executeCommand("proof.publish", { id }, actor);
      const page = (
        await withClient((c) =>
          c.query<{ content: unknown }>(`select content from proof_pages where proof_id=$1`, [id]),
        )
      ).rows[0];
      const published = proofPageContentSchema.parse(page?.content);
      const canvas = await loadPaperCanvas(actor.userId);
      assert.equal(canvas.kind, "cv");
      if (canvas.kind !== "cv") return;
      assert.equal(canvas.lines.length, 1);
      assert.equal(canvas.lines[0]?.words, published.words);
      assert.equal(canvas.lines[0]?.words, SATURDAY_CLOSE);
      assert.equal(canvas.lines[0]?.date, published.date);
      assert.notEqual(canvas.lines[0]?.words, "cut wait time by 40%");
    });
  });

  it("keeps unpublished and skipped dumps off the A4", async (t) => {
    if (!testDatabaseUrl()) {
      t.skip("TEST_DATABASE_URL is not set");
      return;
    }
    await withTestSchema(async () => {
      const actor = await userActor();
      const created = await executeCommand<{ id: string }>(
        "proof.create",
        { title: "" },
        actor,
      );
      const id = created.result.id;
      await executeCommand("proof.log", { proofId: id, body: SATURDAY_CLOSE }, actor);
      await executeCommand("proof.skipQuestion", { id }, actor);
      const canvas = await loadPaperCanvas(actor.userId);
      assert.equal(canvas.kind, "dashed");
    });
  });
});
