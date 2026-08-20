import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";

const creds = z.object({
  email: z.string().email("Enter an email."),
  password: z.string().min(8, "Use at least 8 characters."),
  remember: z.boolean().optional(),
});

export const meFn = createServerFn({ method: "GET" }).handler(async () => {
  const { currentUser } = await import("@/core/auth/session");
  return currentUser();
});

export const signUpFn = createServerFn({ method: "POST" })
  .inputValidator(creds)
  .handler(async ({ data }) => {
    const store = await import("@/core/auth/store");
    const session = await import("@/core/auth/session");
    const existing = await store.findUserByEmail(data.email);
    if (existing) {
      return {
        ok: false as const,
        field: "email" as const,
        error: "That email already has an account. Sign in instead.",
      };
    }
    const id = await store.createUser(data.email, data.password);
    const created = await store.createSession(id, { remember: true });
    await session.setSessionCookie(created.token, created.expires);
    return { ok: true as const };
  });

export const signInFn = createServerFn({ method: "POST" })
  .inputValidator(creds)
  .handler(async ({ data }) => {
    const store = await import("@/core/auth/store");
    const session = await import("@/core/auth/session");
    const user = await store.findUserByEmail(data.email);
    if (!user || !(await store.verifyPassword(data.password, user.password_hash))) {
      return {
        ok: false as const,
        error: "That email and password did not match. Try again.",
      };
    }
    const remember = data.remember !== false;
    const created = await store.createSession(user.id, { remember });
    await session.setSessionCookie(created.token, remember ? created.expires : undefined);
    return { ok: true as const };
  });

export const signedInHomeFn = createServerFn({ method: "POST" }).handler(async () => {
  const { requireUser } = await import("@/core/auth/session");
  const { loadSignedInHome } = await import("@/features/auth/signed-in-home.server");
  const user = await requireUser();
  return loadSignedInHome(user.id, Boolean(user.onboardingCompletedAt));
});

export const signOutFn = createServerFn({ method: "POST" }).handler(async () => {
  const store = await import("@/core/auth/store");
  const session = await import("@/core/auth/session");
  await store.destroySession(await session.sessionToken());
  await session.clearSessionCookie();
  return { ok: true };
});
