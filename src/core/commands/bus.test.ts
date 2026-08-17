import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { withTestSchema, testDatabaseUrl } from "@/core/db/testing";
import { executeCommand, undoCommand } from "@/core/commands/bus";
import { createUser } from "@/core/auth/store";
import { enqueue } from "@/core/jobs/queue";
import { tick } from "@/core/jobs/worker";
import { withClient } from "@/core/db/client.server";
import { loadProfile } from "@/features/profile/load.server";
import "@/features/register";

async function userActor() {
  process.env.SESSION_SECRET ??= "test-session-secret-at-least-32-chars";
  const userId = await createUser(`u${Date.now()}@example.com`, "password12");
  return { kind: "user" as const, userId };
}

describe("command bus", () => {
  it("round-trips a profile update with undo", async (t) => {
    if (!testDatabaseUrl()) {
      t.skip("TEST_DATABASE_URL is not set");
      return;
    }
    await withTestSchema(async () => {
      const actor = await userActor();
      const first = await executeCommand(
        "profile.update",
        { name: "Linh", targetRole: "analyst" },
        actor,
      );
      assert.ok(first.id);
      const profile = await loadProfile(actor.userId);
      assert.equal(profile.name, "Linh");
      assert.equal(profile.targetRole, "analyst");
      await undoCommand(first.id, actor);
      const undone = await loadProfile(actor.userId);
      assert.equal(undone.name, "");
    });
  });

  it("executes profile, paper, proof, pitch, opening, and application commands", async (t) => {
    if (!testDatabaseUrl()) {
      t.skip("TEST_DATABASE_URL is not set");
      return;
    }
    await withTestSchema(async () => {
      const actor = await userActor();
      await executeCommand("profile.addFact", { label: "skill", value: "Python" }, actor);
      await executeCommand(
        "profile.addExperience",
        { org: "Cafe", role: "Barista", detail: ["ran the morning shift"] },
        actor,
      );
      await executeCommand(
        "profile.setEducation",
        { school: "NEU", major: "Econ", year: "2026", gpa: "", courses: ["stats"] },
        actor,
      );
      const paper = await executeCommand<{ id: string }>(
        "paper.create",
        { kind: "cv", fromProfile: true },
        actor,
      );
      const proof = await executeCommand<{ id: string }>(
        "proof.create",
        { title: "Morning shift" },
        actor,
      );
      await executeCommand("proof.log", { proofId: proof.result.id, body: "I opened the cafe" }, actor);
      await executeCommand(
        "proof.arrange",
        { id: proof.result.id, what: "a cafe shift", did: "opened the cafe", came: "regulars came back" },
        actor,
      );
      const published = await executeCommand<{ slug: string }>(
        "proof.publish",
        { id: proof.result.id },
        actor,
      );
      assert.match(published.result.slug, /morning/);
      await executeCommand("pitch.saveBio", { body: "Econ student aiming for analyst work." }, actor);
      await executeCommand("pitch.saveIntro", { body: "I'm Linh, aiming for analyst work." }, actor);
      await executeCommand(
        "pitch.addAnswer",
        { prompt: "Tell me about a time you led.", body: "I opened the cafe and ran the morning shift." },
        actor,
      );
      const opening = await executeCommand<{ id: string }>(
        "opening.add",
        { rawText: "Need Python\nNeed SQL\nNeed a project" },
        actor,
      );
      const app = await executeCommand<{ id: string }>(
        "application.create",
        { openingId: opening.result.id },
        actor,
      );
      await executeCommand(
        "application.tailorCv",
        { id: app.result.id, paperId: paper.result.id },
        actor,
      );
      await executeCommand("application.setStatus", { id: app.result.id, status: "applied" }, actor);
      const { rows } = await withClient((c) =>
        c.query(`select status, cv_paper_id from applications where id=$1`, [app.result.id]),
      );
      assert.equal(rows[0].status, "applied");
      assert.ok(rows[0].cv_paper_id);
      assert.notEqual(rows[0].cv_paper_id, paper.result.id);
    });
  });
});

describe("worker", () => {
  it("drains a deadline notification job", async (t) => {
    if (!testDatabaseUrl()) {
      t.skip("TEST_DATABASE_URL is not set");
      return;
    }
    await withTestSchema(async () => {
      const actor = await userActor();
      await enqueue(
        "notify.deadline",
        { userId: actor.userId, applicationId: "app1", role: "analyst" },
        new Date(Date.now() - 1000),
      );
      const did = await tick();
      assert.equal(did, true);
      const { rows } = await withClient((c) =>
        c.query(`select kind from notifications where user_id=$1`, [actor.userId]),
      );
      assert.equal(rows[0]?.kind, "deadline");
    });
  });
});
