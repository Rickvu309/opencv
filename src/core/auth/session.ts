import { SESSION_COOKIE, readSession } from "@/core/auth/store";

type CookieFns = {
  getCookie?: (name: string) => string | undefined;
  setCookie?: (
    name: string,
    value: string,
    opts: Record<string, unknown>,
  ) => void;
  deleteCookie?: (name: string) => void;
};

async function cookies(): Promise<CookieFns> {
  const mod = (await import("@tanstack/react-start/server")) as CookieFns;
  return mod;
}

export async function sessionToken() {
  const { getCookie } = await cookies();
  return getCookie?.(SESSION_COOKIE);
}

export async function setSessionCookie(token: string, expires?: Date) {
  const { setCookie } = await cookies();
  setCookie?.(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(expires ? { expires } : {}),
  });
}

export async function clearSessionCookie() {
  const { deleteCookie } = await cookies();
  deleteCookie?.(SESSION_COOKIE);
}

export async function currentUser() {
  const token = await sessionToken();
  const session = await readSession(token);
  if (session?.renewedExpires && token) {
    await setSessionCookie(token, session.renewedExpires);
  }
  if (!session) return null;
  return {
    id: session.id,
    email: session.email,
    onboardingCompletedAt: session.onboardingCompletedAt,
  };
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new Error("sign in needed");
  return user;
}
