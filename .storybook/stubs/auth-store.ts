export const SESSION_COOKIE = "op_session";
export const SESSION_DAYS = 30;

export type SessionUser = {
  id: string;
  email: string;
  onboardingCompletedAt: string | null;
  renewedExpires?: Date;
};

export function hashToken(_token: string) {
  return "";
}

export async function hashPassword(_password: string) {
  return "";
}

export async function verifyPassword(_password: string, _hash: string) {
  return false;
}

export async function createSession(_userId: string, _opts?: { remember?: boolean }) {
  return { token: "story", expires: new Date(), remember: true };
}

export async function readSession(_token: string | undefined): Promise<SessionUser | null> {
  return null;
}

export async function destroySession(_token: string | undefined) {}

export async function purgeExpiredSessions() {}

export async function createUser(_email: string, _password: string) {
  return "story";
}

export async function findUserByEmail(_email: string) {
  return null;
}
