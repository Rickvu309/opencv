import { createServerFn } from "@tanstack/react-start";
import { completeness } from "@/features/profile/model";

export const getProfileFn = createServerFn({ method: "GET" }).handler(async () => {
  const { requireUser } = await import("@/core/auth/session");
  const { loadProfile } = await import("@/features/profile/load.server");
  const user = await requireUser();
  const profile = await loadProfile(user.id);
  return { profile, completeness: completeness(profile) };
});
