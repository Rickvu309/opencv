import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { newId, newToken } from "@/core/ids";
import { withClient } from "@/core/db/client.server";
import { requireEnv } from "@/core/config/env";

export const SESSION_COOKIE = "op_session";
export const SESSION_DAYS = 30;
const SESSION_SHORT_MS = 24 * 60 * 60 * 1000;
const SESSION_LONG_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;

export type SessionUser = {
  id: string;
  email: string;
  onboardingCompletedAt: string | null;
  renewedExpires?: Date;
};

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string, opts?: { remember?: boolean }) {
  requireEnv("SESSION_SECRET");
  const remember = opts?.remember !== false;
  const token = newToken();
  const expires = new Date(Date.now() + (remember ? SESSION_LONG_MS : SESSION_SHORT_MS));
  await withClient((c) =>
    c.query(
      `insert into sessions (id, user_id, expires_at) values ($1, $2, $3)`,
      [hashToken(token), userId, expires.toISOString()],
    ),
  );
  return { token, expires, remember };
}

export async function readSession(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const { rows } = await withClient((c) =>
    c.query<{
      user_id: string;
      email: string;
      onboarding_completed_at: string | null;
      created_at: string;
      expires_at: string;
    }>(
      `select u.id as user_id, u.email, u.onboarding_completed_at, s.created_at, s.expires_at
       from sessions s
       join users u on u.id = s.user_id
       where s.id = $1 and s.expires_at > now()`,
      [hashToken(token)],
    ),
  );
  const row = rows[0];
  if (!row) return null;
  const user: SessionUser = {
    id: row.user_id,
    email: row.email,
    onboardingCompletedAt: row.onboarding_completed_at,
  };
  const created = new Date(row.created_at).getTime();
  const expires = new Date(row.expires_at).getTime();
  const remembered = expires - created >= SESSION_LONG_MS / 2;
  const remaining = expires - Date.now();
  if (remembered && remaining < SESSION_LONG_MS / 2) {
    const next = new Date(Date.now() + SESSION_LONG_MS);
    await withClient((c) =>
      c.query(`update sessions set expires_at = $2 where id = $1`, [
        hashToken(token),
        next.toISOString(),
      ]),
    );
    user.renewedExpires = next;
  }
  return user;
}

export async function destroySession(token: string | undefined) {
  if (!token) return;
  await withClient((c) =>
    c.query(`delete from sessions where id = $1`, [hashToken(token)]),
  );
}

export async function purgeExpiredSessions() {
  await withClient((c) => c.query(`delete from sessions where expires_at < now()`));
}

export async function createUser(email: string, password: string) {
  const id = newId();
  const passwordHash = await hashPassword(password);
  await withClient(async (c) => {
    await c.query(
      `insert into users (id, email, password_hash) values ($1, $2, $3)`,
      [id, email.trim().toLowerCase(), passwordHash],
    );
    await c.query(`insert into profiles (user_id) values ($1)`, [id]);
    await c.query(`insert into profile_education (user_id) values ($1)`, [id]);
  });
  return id;
}

export async function findUserByEmail(email: string) {
  const { rows } = await withClient((c) =>
    c.query<{ id: string; password_hash: string }>(
      `select id, password_hash from users where lower(email) = lower($1)`,
      [email.trim()],
    ),
  );
  return rows[0] ?? null;
}
