import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { withTestSchema, testDatabaseUrl } from "@/core/db/testing";
import { executeCommand } from "@/core/commands/bus";
import { createUser } from "@/core/auth/store";
import { loadProfile } from "@/features/profile/load.server";
import "@/features/register";

async function userActor() {
  process.env.SESSION_SECRET ??= "test-session-secret-at-least-32-chars";
  const userId = await createUser(`u${Date.now()}@example.com`, "password12");
  return { kind: "user" as const, userId };
}

describe("profile page write path", () => {
  it("stores name, a null goal, school, empty experience, and links", async (t) => {
    if (!testDatabaseUrl()) {
      t.skip("TEST_DATABASE_URL is not set");
      return;
    }
    await withTestSchema(async () => {
      const actor = await userActor();
      await executeCommand("profile.update", { name: "Ánh", targetRole: null }, actor);
      await executeCommand(
        "profile.setEducation",
        { school: "NEU", major: "Finance", year: "2026", gpa: "", courses: [] },
        actor,
      );
      const added = await executeCommand<{ id: string }>(
        "profile.addExperience",
        { org: "", role: "", dateFrom: "", dateTo: "", detail: [] },
        actor,
      );
      await executeCommand(
        "profile.updateExperience",
        {
          id: added.result.id,
          org: "Grab",
          role: "Intern",
          dateFrom: "",
          dateTo: "",
          detail: [],
        },
        actor,
      );
      await executeCommand(
        "profile.setLink",
        { kind: "linkedin", url: "https://linkedin.com/in/anh" },
        actor,
      );
      await executeCommand("profile.setLink", { kind: "github", url: "" }, actor);

      const profile = await loadProfile(actor.userId);
      assert.equal(profile.name, "Ánh");
      assert.equal(profile.targetRole, null);
      assert.equal(profile.education.school, "NEU");
      assert.equal(profile.experience[0]?.org, "Grab");
      assert.equal(profile.experience[0]?.role, "Intern");
      assert.equal(profile.links.find((link) => link.kind === "linkedin")?.url, "https://linkedin.com/in/anh");
      assert.equal(profile.links.find((link) => link.kind === "github")?.url, "");
    });
  });
});
