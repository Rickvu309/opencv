import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { completeness } from "@/features/profile/model";

export const completeOnboardingFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      targetRole: z.string().nullable(),
      school: z.string().default(""),
      major: z.string().default(""),
      year: z.string().default(""),
      org: z.string().default(""),
      role: z.string().default(""),
      linkKind: z.enum(["linkedin", "github", "portfolio"]).optional(),
      linkUrl: z.string().default(""),
    }),
  )
  .handler(async ({ data }) => {
    const { requireUser } = await import("@/core/auth/session");
    const { seedOnboarding } = await import("@/features/onboarding/commands.server");
    const user = await requireUser();
    await seedOnboarding(
      { kind: "user", userId: user.id },
      {
        targetRole: data.targetRole,
        school: data.school,
        major: data.major,
        year: data.year,
        experience: data.org ? { org: data.org, role: data.role || "Member" } : undefined,
        link: data.linkKind && data.linkUrl ? { kind: data.linkKind, url: data.linkUrl } : undefined,
      },
    );
    return { ok: true };
  });

export const checklistFn = createServerFn({ method: "GET" }).handler(async () => {
  const { requireUser } = await import("@/core/auth/session");
  const { withClient } = await import("@/core/db/client.server");
  const { loadProfile } = await import("@/features/profile/load.server");
  const user = await requireUser();
  const profile = await loadProfile(user.id);
  return withClient(async (c) => {
    const papers = (await c.query(`select count(*)::int as n from papers where user_id=$1`, [user.id])).rows[0].n;
    const convos = (await c.query(`select count(*)::int as n from conversations where user_id=$1`, [user.id])).rows[0].n;
    const dismissed = (
      await c.query(`select checklist_dismissed_at from users where id=$1`, [user.id])
    ).rows[0]?.checklist_dismissed_at;
    return {
      dismissed: Boolean(dismissed),
      items: [
        { id: "goal", label: "Set a goal", done: Boolean(profile.targetRole) || (profile.targetRole === null && completeness(profile) > 0) },
        { id: "fact", label: "Add a fact", done: profile.facts.length + profile.experience.length > 0 || Boolean(profile.education.school) },
        { id: "cv", label: "Build a first CV", done: papers > 0 },
        { id: "coach", label: "Ask the Coach", done: convos > 0 },
      ],
    };
  });
});
