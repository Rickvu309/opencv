import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * The value in the cookie, and how it is proved genuine.
 *
 * ## Three values, and why they are not the same one
 *
 * - The **token** is 32 random bytes. Only the browser holds it.
 * - The **cookie** is `token.signature`, where the signature is an HMAC of the
 *   token under a server secret. The browser holds this too.
 * - The **row id** is the SHA-256 of the token. Only the database holds it.
 *
 * The signature exists so that a request carrying nonsense can be refused
 * without asking the database anything. That matters because the gate runs on
 * every request, including the ones the browser prefetches, and a database
 * round trip to Southeast Asia on each of those is a cost the user pays in
 * latency for no security at all. The signature is not the security; the row
 * is. It is a filter in front of it.
 *
 * The hash exists so that a leaked copy of the `sessions` table is a list of
 * hashes rather than a set of working keys, for the same reason the passwords
 * beside them are hashed. SHA-256 with no salt and no cost is right here and
 * wrong for passwords: the input is 32 random bytes, so there is nothing to
 * guess and nothing to precompute.
 */

/** The one cookie this product sets. */
export const SESSION_COOKIE = "openpath_session";

/**
 * The session cookie's value out of a raw `Cookie` header.
 *
 * For the two places that have a `Request` rather than Start's cookie helper: the
 * sign-out route and the agent channel. Written once here so neither has to
 * parse a header correctly on its own.
 */
export function readSessionCookie(header: string | null | undefined): string | undefined {
  if (!header) return undefined;
  for (const pair of header.split(";")) {
    const trimmed = pair.trimStart();
    if (trimmed.startsWith(`${SESSION_COOKIE}=`)) {
      return trimmed.slice(SESSION_COOKIE.length + 1);
    }
  }
  return undefined;
}

export function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  // A short secret makes the signature decorative. Refuse rather than pretend.
  if (secret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters");
  }
  return secret;
}

/** A fresh token. Base64url so it survives a cookie header unescaped. */
export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

/** What the `sessions` row is keyed by. Never the token itself. */
export function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function signatureFor(token: string, secret: string): string {
  return createHmac("sha256", secret).update(token).digest("base64url");
}

/** The cookie value for a token: the token, and proof we issued it. */
export function signToken(token: string, secret: string = sessionSecret()): string {
  return `${token}.${signatureFor(token, secret)}`;
}

/**
 * The token inside a cookie value, or null if it was not signed by us.
 *
 * Constant-time comparison, because the alternative leaks the signature one
 * byte at a time to anyone willing to measure. That attack is impractical over
 * the public internet and trivial to prevent, which makes it a bad thing to
 * skip on the grounds of difficulty.
 */
export function readToken(
  cookie: string | undefined,
  secret: string = sessionSecret(),
): string | null {
  if (!cookie) return null;

  // Exactly one separator. A token cannot contain a dot (base64url does not
  // use one), so anything else is malformed rather than merely wrong.
  const parts = cookie.split(".");
  if (parts.length !== 2) return null;
  const [token, signature] = parts;
  if (!token || !signature) return null;

  const expected = Buffer.from(signatureFor(token, secret));
  const given = Buffer.from(signature);
  // `timingSafeEqual` throws on a length mismatch, which is itself a signal,
  // but only about the length of a value the attacker already chose.
  if (expected.length !== given.length) return null;
  return timingSafeEqual(expected, given) ? token : null;
}

/**
 * How the cookie is set on a response.
 *
 * `httpOnly` keeps it away from scripts, so a cross-site scripting hole costs
 * an account's data rather than the account itself. `sameSite: lax` is what
 * stops another site from making a request that carries it, while still
 * allowing an ordinary link into the product to arrive signed in. `secure` is
 * conditional only because `localhost` is not served over HTTPS and a secure
 * cookie there is a cookie the browser silently drops.
 */
export function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires,
  };
}
