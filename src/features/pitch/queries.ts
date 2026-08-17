import { createServerFn } from "@tanstack/react-start";

export const listPitchFn = createServerFn({ method: "GET" }).handler(async () => {
  const { requireUser } = await import("@/core/auth/session");
  const { withClient } = await import("@/core/db/client.server");
  const user = await requireUser();
  const { rows } = await withClient((c) =>
    c.query(
      `select id, kind, prompt, body from pitch_items where user_id=$1 order by updated_at desc`,
      [user.id],
    ),
  );
  return {
    bio: rows.find((r: { kind: string }) => r.kind === "bio") ?? null,
    intro: rows.find((r: { kind: string }) => r.kind === "intro") ?? null,
    answers: rows.filter((r: { kind: string }) => r.kind === "answer"),
  };
});

export const draftBioFn = createServerFn({ method: "POST" }).handler(async () => {
  const { requireUser } = await import("@/core/auth/session");
  const { loadProfile } = await import("@/features/profile/load.server");
  const { complete } = await import("@/core/ai/gateway");
  const user = await requireUser();
  const profile = await loadProfile(user.id);
  const ai = await complete({
    role: "drafting",
    userId: user.id,
    system: "Write a 2-3 sentence professional bio from the profile only. No exclamation marks.",
    prompt: JSON.stringify(profile),
  });
  if (ai.unavailable) {
    return [profile.name, profile.targetRole, profile.education.school].filter(Boolean).join(" · ");
  }
  return ai.text.trim();
});

export const draftIntroFn = createServerFn({ method: "POST" }).handler(async () => {
  const { requireUser } = await import("@/core/auth/session");
  const { loadProfile } = await import("@/features/profile/load.server");
  const { complete } = await import("@/core/ai/gateway");
  const user = await requireUser();
  const profile = await loadProfile(user.id);
  if (!profile.targetRole) return null;
  const ai = await complete({
    role: "drafting",
    userId: user.id,
    system: "Write a spoken self-introduction from the profile and goal. No invented experience.",
    prompt: JSON.stringify(profile),
  });
  if (ai.unavailable) {
    return `I'm ${profile.name || "a student"}, aiming for ${profile.targetRole}.`;
  }
  return ai.text.trim();
});
