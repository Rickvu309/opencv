// The forms show what this module returns, so these tests are about two
// things: that every code the server can send has words, and that the one
// error which must not name a field does not name one.

import { test } from "node:test";
import assert from "node:assert/strict";

import { authProblem } from "@/lib/auth/problems";

/** Every code the auth routes and the account service can answer with. */
const CODES = [
  "username-required",
  "password-required",
  "username-too-long",
  "password-too-short",
  "username-taken",
  "bad-credentials",
  "rate-limited",
  "store-down",
  "bad-request",
  "no-session",
  "offline",
];

test("every code the server can send has words", () => {
  for (const code of CODES) {
    const { message } = authProblem(code);
    assert.ok(message && message.trim().length > 0, `${code} has nothing to say`);
  }
});

test("a code this client has not been taught still says something useful", () => {
  // A newer server, or a proxy inventing its own body. Silence would leave the
  // form looking like it did nothing at all.
  const { field, message } = authProblem("something-new");
  assert.equal(field, "form");
  assert.ok(message.length > 0);
  assert.deepEqual(authProblem(undefined), authProblem("something-new"));
});

test("AC-ACCT-001.3: an empty field error points at that field", () => {
  assert.equal(authProblem("username-required").field, "username");
  assert.equal(authProblem("password-required").field, "password");
  assert.equal(authProblem("username-taken").field, "username");
  assert.equal(authProblem("password-too-short").field, "password");
});

test("AC-ACCT-002.2: a bad sign-in names neither field", () => {
  // Putting this under the password would say the username was fine, which is
  // the disclosure the requirement exists to prevent, made by the layout
  // rather than by the words.
  const { field, message } = authProblem("bad-credentials");
  assert.equal(field, "form");
  assert.ok(
    message.toLowerCase().includes("password"),
    "the message should mention the password, not only the username",
  );
  assert.notEqual(
    message.toLowerCase().includes("no such user"),
    true,
    "the message must not say the account does not exist",
  );
});

test("the messages differ from each other, so the form is not the same sentence twice", () => {
  const taken = authProblem("username-taken").message;
  const bad = authProblem("bad-credentials").message;
  const rate = authProblem("rate-limited").message;
  assert.equal(new Set([taken, bad, rate]).size, 3);
});
