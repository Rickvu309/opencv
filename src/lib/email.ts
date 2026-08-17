/**
 * What counts as an email address here.
 *
 * Deliberately not RFC 5322. That grammar accepts things no mail provider will
 * deliver to, and rejecting a real address is the expensive mistake: the person
 * leaves. This checks the shape a human recognises, bounds the length so the
 * store cannot be filled with one submission, and leaves the rest to reality.
 *
 * Shared by the client and the server so the two never disagree about what is
 * valid, but the server's copy is the one that decides. The client's is a
 * courtesy that saves a round trip.
 */

/** One `@`, something either side, a dot in the domain, no spaces. */
const SHAPE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/** RFC 5321 caps a path at 254 characters. Anything longer is not an address. */
const MAX_LENGTH = 254;

export type EmailProblem = "empty" | "shape" | "too-long";

/** `null` when the address is usable, otherwise why it is not. */
export function checkEmail(raw: string): EmailProblem | null {
  const email = raw.trim();
  if (email.length === 0) return "empty";
  if (email.length > MAX_LENGTH) return "too-long";
  if (!SHAPE.test(email)) return "shape";
  return null;
}

/**
 * Addresses are compared case-insensitively and without surrounding space,
 * because `Minh@Example.com ` and `minh@example.com` are one person.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
