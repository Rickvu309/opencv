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

import type { Msg } from "@/lib/i18n/locale";
import { messages } from "@/lib/i18n/messages";

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
 * What to show the person who typed it, in both languages.
 *
 * Returns the pair rather than a string because this module is shared by the
 * client and the server, and the server does not know which language this
 * browser reads. The client resolves it; the server sends a code instead.
 */
export function emailProblemMessage(problem: EmailProblem): Msg {
  switch (problem) {
    case "empty":
      return messages.errors.waitlistEmailEmpty;
    case "too-long":
      return messages.errors.waitlistEmailTooLong;
    case "shape":
      return messages.errors.waitlistEmailShape;
  }
}

/** The wire format between the API and the client: stable, not a sentence. */
export type WaitlistErrorCode =
  | "email-empty"
  | "email-shape"
  | "email-too-long"
  | "bad-request"
  | "rate-limited"
  | "store-down";

export function problemCode(problem: EmailProblem): WaitlistErrorCode {
  return problem === "empty"
    ? "email-empty"
    : problem === "too-long"
      ? "email-too-long"
      : "email-shape";
}

/**
 * Addresses are compared case-insensitively and without surrounding space,
 * because `Minh@Example.com ` and `minh@example.com` are one person.
 *
 * Lives here rather than beside the store because it is a pure string function
 * with no storage concern, and the store talks to Postgres. Anything that
 * needs to normalize an address should not have to drag that along.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
