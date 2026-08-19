import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { withTestSchema, testDatabaseUrl } from "@/core/db/testing";
import { executeCommand } from "@/core/commands/bus";
import { createUser } from "@/core/auth/store";
import { withClient } from "@/core/db/client.server";
import { proofPageContentSchema } from "@/features/proof/model";
import "@/features/register";

const SATURDAY_CLOSE =
  "Saturday close. We ran out of oat milk and I stayed until the last table left.";

async function userActor() {
  process.env.SESSION_SECRET ??= "test-session-secret-at-least-32-chars";
  const userId = await createUser(`u${Date.now()}@example.com`, "password12");
  return { kind: "user" as const, userId };
}

async function dumpShift(actor: { kind: "user"; userId: string }) {
  const created = await executeCommand<{ id: string }>("proof.create", { title: "" }, actor);
  const id = created.result.id;
  await executeCommand("proof.log", { proofId: id, body: SATURDAY_CLOSE }, actor);
  return id;
}

async function publishedContent(proofId: string) {
  const { rows } = await withClient((c) =>
    c.query<{ slug: string; content: unknown }>(
      `select slug, content from proof_pages where proof_id=$1`,
      [proofId],
    ),
  );
  return rows[0] ?? null;
}

describe("proof.publish", () => {
  it("publishes a dump without arrange", async (t) => {
    if (!testDatabaseUrl()) {
      t.skip("TEST_DATABASE_URL is not set");
      return;
    }
    await withTestSchema(async () => {
      const actor = await userActor();
      const id = await dumpShift(actor);
      const published = await executeCommand<{ ok: boolean; slug: string }>(
        "proof.publish",
        { id },
        actor,
      );
      assert.equal(published.result.ok, true);
      assert.ok(published.result.slug);
      const page = await publishedContent(id);
      assert.ok(page);
      const content = proofPageContentSchema.parse(page.content);
      assert.match(content.words, /Saturday close/);
      assert.match(content.words, /oat milk/);
      assert.ok(content.date);
      assert.equal(content.came, undefined);
    });
  });

  it("publishes after skip without an interview answer", async (t) => {
    if (!testDatabaseUrl()) {
      t.skip("TEST_DATABASE_URL is not set");
      return;
    }
    await withTestSchema(async () => {
      const actor = await userActor();
      const id = await dumpShift(actor);
      await executeCommand("proof.skipQuestion", { id }, actor);
      const published = await executeCommand<{ ok: boolean; slug: string }>(
        "proof.publish",
        { id },
        actor,
      );
      assert.equal(published.result.ok, true);
      const page = await publishedContent(id);
      assert.ok(page);
      const content = proofPageContentSchema.parse(page.content);
      assert.equal(content.words, SATURDAY_CLOSE);
      assert.equal(content.came, undefined);
    });
  });

  it("does not mint a public page from arrange", async (t) => {
    if (!testDatabaseUrl()) {
      t.skip("TEST_DATABASE_URL is not set");
      return;
    }
    await withTestSchema(async () => {
      const actor = await userActor();
      const id = await dumpShift(actor);
      await executeCommand(
        "proof.arrange",
        {
          id,
          what: "a Saturday close",
          did: "I stayed until the last table left",
          came: "the floor was clear",
        },
        actor,
      );
      const page = await publishedContent(id);
      assert.equal(page, null);
      const { rows } = await withClient((c) =>
        c.query<{ status: string }>(`select status from proofs where id=$1`, [id]),
      );
      assert.equal(rows[0]?.status, "logging");
    });
  });

  it("keeps a missing third part missing on the public card", async (t) => {
    if (!testDatabaseUrl()) {
      t.skip("TEST_DATABASE_URL is not set");
      return;
    }
    await withTestSchema(async () => {
      const actor = await userActor();
      const id = await dumpShift(actor);
      await executeCommand(
        "proof.arrange",
        { id, what: "a Saturday close", did: SATURDAY_CLOSE, came: "" },
        actor,
      );
      const published = await executeCommand<{ ok: boolean; slug: string }>(
        "proof.publish",
        { id },
        actor,
      );
      assert.equal(published.result.ok, true);
      const page = await publishedContent(id);
      assert.ok(page);
      const content = proofPageContentSchema.parse(page.content);
      assert.equal(content.words, SATURDAY_CLOSE);
      assert.equal(content.what, "a Saturday close");
      assert.equal(content.did, SATURDAY_CLOSE);
      assert.equal(content.came, undefined);
      assert.ok(!/"came"\s*:/.test(JSON.stringify(page.content)));
    });
  });
});
