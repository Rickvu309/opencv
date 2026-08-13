// The cookie is the only thing an attacker can hold in their hand, so these
// tests are about what happens when it is not the one we issued.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  cookieOptions,
  newToken,
  readToken,
  signToken,
  tokenHash,
} from "@/lib/auth/cookie";

const SECRET = "a".repeat(48);
const OTHER = "b".repeat(48);

test("a cookie we signed gives its token back", () => {
  const token = newToken();
  assert.equal(readToken(signToken(token, SECRET), SECRET), token);
});

test("tokens are not guessable and never repeat", () => {
  const seen = new Set(Array.from({ length: 500 }, () => newToken()));
  assert.equal(seen.size, 500);
  // 32 bytes, base64url: 43 characters, no padding.
  assert.equal(newToken().length, 43);
});

test("a tampered token is refused", () => {
  const token = newToken();
  const cookie = signToken(token, SECRET);
  // Change the token, keep the signature. This is the whole attack: an
  // attacker who could do this could name any session they liked.
  const [, signature] = cookie.split(".");
  assert.equal(readToken(`${newToken()}.${signature}`, SECRET), null);
});

test("a tampered signature is refused", () => {
  const token = newToken();
  const [value] = signToken(token, SECRET).split(".");
  assert.equal(readToken(`${value}.notasignature`, SECRET), null);
});

test("a cookie signed with another secret is refused", () => {
  // What rotating the secret does: every outstanding cookie stops working,
  // which is the intended effect and worth knowing is the effect.
  assert.equal(readToken(signToken(newToken(), OTHER), SECRET), null);
});

test("malformed cookies are refused rather than throwing", () => {
  for (const value of [undefined, "", ".", "no-dot", "a.b.c", ".signature", "token."]) {
    assert.equal(readToken(value, SECRET), null, `${JSON.stringify(value)} got through`);
  }
});

test("the row id is the hash, and never the token", () => {
  const token = newToken();
  const hash = tokenHash(token);
  assert.notEqual(hash, token);
  assert.equal(hash.length, 64, "sha256 in hex");
  assert.equal(tokenHash(token), hash, "the same token always hashes the same");
  assert.notEqual(tokenHash(newToken()), hash);
});

test("the cookie cannot be read by scripts and does not travel cross-site", () => {
  const expires = new Date("2030-01-01T00:00:00Z");
  const options = cookieOptions(expires);
  assert.equal(options.httpOnly, true, "a script must not be able to read it");
  assert.equal(options.sameSite, "lax", "another site must not be able to send it");
  assert.equal(options.path, "/");
  assert.equal(options.expires, expires, "the cookie expires with the row");
});

test("a secret that is too short is refused rather than used", async () => {
  // A short secret makes the signature decorative, and the failure is silent
  // unless something refuses. Checked through the module's own reader so the
  // guard cannot be bypassed by calling a different function.
  const previous = process.env.SESSION_SECRET;
  try {
    process.env.SESSION_SECRET = "short";
    const { sessionSecret } = await import("@/lib/auth/cookie");
    assert.throws(() => sessionSecret(), /at least 32/);

    delete process.env.SESSION_SECRET;
    assert.throws(() => sessionSecret(), /not set/);
  } finally {
    if (previous === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previous;
  }
});
