import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { withTestSchema, testDatabaseUrl } from "@/core/db/testing";
import { createUser, createSession, readSession, purgeExpiredSessions } from "@/core/auth/store";
import { withClient } from "@/core/db/client.server";
import { enqueue } from "@/core/jobs/queue";
import { tick } from "@/core/jobs/worker";

describe("sessions", () => {
  it("keeps remembered sessions for 30 days and short ones for a day", async (t) => {
    if (!testDatabaseUrl()) {
      t.skip("TEST_DATABASE_URL is not set");
      return;
    }
    process.env.SESSION_SECRET ??= "test-session-secret-at-least-32-chars";
    await withTestSchema(async () => {
      const userId = await createUser(`s${Date.now()}@example.com`, "password12");
      const remembered = await createSession(userId, { remember: true });
      const short = await createSession(userId, { remember: false });
      const day = 24 * 60 * 60 * 1000;
      assert.ok(remembered.expires.getTime() - Date.now() > 20 * day);
      assert.ok(short.expires.getTime() - Date.now() < 2 * day);
      assert.ok(await readSession(remembered.token));
      assert.ok(await readSession(short.token));
    });
  });

  it("renews a remembered session past halfway and purges expired rows", async (t) => {
    if (!testDatabaseUrl()) {
      t.skip("TEST_DATABASE_URL is not set");
      return;
    }
    process.env.SESSION_SECRET ??= "test-session-secret-at-least-32-chars";
    await withTestSchema(async () => {
      const userId = await createUser(`r${Date.now()}@example.com`, "password12");
      const created = await createSession(userId, { remember: true });
      const hashed = (
        await withClient((c) =>
          c.query<{ id: string }>(`select id from sessions where user_id=$1`, [userId]),
        )
      ).rows[0]!.id;
      await withClient((c) =>
        c.query(
          `update sessions set created_at = now() - interval '20 days', expires_at = now() + interval '10 days' where id=$1`,
          [hashed],
        ),
      );
      const renewed = await readSession(created.token);
      assert.ok(renewed?.renewedExpires);
      assert.ok(renewed.renewedExpires.getTime() - Date.now() > 20 * 24 * 60 * 60 * 1000);

      await withClient((c) =>
        c.query(`update sessions set expires_at = now() - interval '1 hour' where id=$1`, [hashed]),
      );
      assert.equal(await readSession(created.token), null);
      await purgeExpiredSessions();
      const leftover = (
        await withClient((c) => c.query(`select count(*)::int as n from sessions`))
      ).rows[0] as { n: number };
      assert.equal(leftover.n, 0);

      await enqueue("session.purge", {}, new Date(Date.now() - 1000));
      assert.equal(await tick(), true);
    });
  });
});
