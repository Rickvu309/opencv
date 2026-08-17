import { z } from "zod";
import { defineCommand } from "@/core/commands/define";
import { executeCommand } from "@/core/commands/bus";

defineCommand({
  name: "onboarding.complete",
  agent: false,
  description: "Mark first-run onboarding complete.",
  input: z.object({}),
  async handler({ actor, client }) {
    await client.query(
      `update users set onboarding_completed_at = coalesce(onboarding_completed_at, now()) where id=$1`,
      [actor.userId],
    );
    return { result: { ok: true }, inverse: null };
  },
});

defineCommand({
  name: "onboarding.dismissChecklist",
  agent: false,
  description: "Hide the activation checklist.",
  input: z.object({}),
  async handler({ actor, client }) {
    await client.query(
      `update users set checklist_dismissed_at = now() where id=$1`,
      [actor.userId],
    );
    return { result: { ok: true }, inverse: null };
  },
});

export async function seedOnboarding(
  actor: { kind: "user"; userId: string },
  data: {
    targetRole: string | null;
    school: string;
    major: string;
    year: string;
    experience?: { org: string; role: string };
    link?: { kind: "linkedin" | "github" | "portfolio"; url: string };
  },
) {
  await executeCommand(
    "profile.update",
    { targetRole: data.targetRole, name: "" },
    actor,
  );
  if (data.school) {
    await executeCommand(
      "profile.setEducation",
      { school: data.school, major: data.major, year: data.year, gpa: "", courses: [] },
      actor,
    );
  }
  if (data.experience) {
    await executeCommand("profile.addExperience", { ...data.experience, detail: [] }, actor);
  }
  if (data.link) {
    await executeCommand("profile.setLink", data.link, actor);
  }
  await executeCommand("onboarding.complete", {}, actor);
}
