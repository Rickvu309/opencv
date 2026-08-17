import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";

const creds = z.object({
  email: z.string().email("enter an email"),
  password: z.string().min(8, "password needs 8 characters"),
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
      return { ok: false as const, error: "that email already has an account. sign in instead." };
    }
    const id = await store.createUser(data.email, data.password);
    const created = await store.createSession(id);
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
      return { ok: false as const, error: "that email and password did not match. try again." };
    }
    const created = await store.createSession(user.id);
    await session.setSessionCookie(created.token, created.expires);
    return { ok: true as const };
  });

export const signOutFn = createServerFn({ method: "POST" }).handler(async () => {
  const store = await import("@/core/auth/store");
  const session = await import("@/core/auth/session");
  await store.destroySession(await session.sessionToken());
  await session.clearSessionCookie();
  return { ok: true };
});
