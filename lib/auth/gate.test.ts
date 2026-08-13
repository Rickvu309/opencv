// The gate decides what the internet can reach. Every one of these is a URL
// somebody will eventually type.

import { test } from "node:test";
import assert from "node:assert/strict";

import { SIGN_IN_PATH, gateFor, safeNext } from "@/lib/auth/gate";

/** The screens the product is made of. AC-ACCT-005.1 covers all of them. */
const PRODUCT_SCREENS = [
  "/coach",
  "/todo",
  "/career-map",
  "/cv",
  "/plan",
  "/profile",
  "/onboarding",
  "/dev/chat",
];

test("without a session, every product screen sends the user to sign in", () => {
  for (const path of PRODUCT_SCREENS) {
    const decision = gateFor(path, false);
    assert.equal(decision.allow, false, `${path} was left open`);
    assert.ok(
      decision.allow === false && decision.redirectTo.startsWith(SIGN_IN_PATH),
      `${path} was sent somewhere other than sign-in`,
    );
  }
});

test("a screen nobody has written yet is closed, not open", () => {
  // The reason the rule is a list of open paths rather than closed ones: the
  // screen added next month is closed by default, and the failure mode of
  // getting it wrong is a redirect rather than a leak.
  const decision = gateFor("/applications", false);
  assert.equal(decision.allow, false);
});

test("the landing page and account creation are open, as the requirement says", () => {
  // AC-ACCT-005.2, exactly.
  for (const path of ["/", "/sign-in", "/sign-up"]) {
    assert.deepEqual(gateFor(path, false), { allow: true }, `${path} was closed`);
  }
});

test("the machinery a visitor needs before an account is open", () => {
  for (const path of [
    "/api/auth/sign-in",
    "/api/auth/sign-up",
    "/api/auth/sign-out",
    "/api/waitlist",
    "/eve/v1/session/abc/stream",
    "/.well-known/workflow/callback",
    "/_next/static/chunks/main.js",
    "/favicon.ico",
    "/globe.svg",
  ]) {
    assert.deepEqual(gateFor(path, false), { allow: true }, `${path} was closed`);
  }
});

test("with a session, everything is open", () => {
  for (const path of [...PRODUCT_SCREENS, "/", "/anything"]) {
    assert.deepEqual(gateFor(path, true), { allow: true }, `${path} was closed`);
  }
});

test("the redirect carries where the user was going", () => {
  const decision = gateFor("/cv", false);
  assert.equal(decision.allow, false);
  assert.ok(
    decision.allow === false && decision.redirectTo === `${SIGN_IN_PATH}?next=%2Fcv`,
  );
});

test("the return path cannot be pointed at another site", () => {
  // Without this check, a link to /sign-in?next=https://not-us.example lands
  // somebody on a copy of this product that asks for their password.
  assert.equal(safeNext("https://not-us.example"), null);
  assert.equal(safeNext("//not-us.example"), null);
  assert.equal(safeNext("http://not-us.example"), null);
  assert.equal(safeNext("javascript:alert(1)"), null);
  assert.equal(safeNext(""), null);
  assert.equal(safeNext(null), null);
  // And a loop back to itself is not a destination either.
  assert.equal(safeNext(SIGN_IN_PATH), null);
  // An ordinary path is fine.
  assert.equal(safeNext("/cv"), "/cv");
});

test("a path that only looks like an asset is still gated when it is a screen", () => {
  // The dot test is a heuristic, so it is worth knowing what it does: a screen
  // with a dot in its last segment would be treated as a file. No route in
  // this product has one, and this records the limit rather than hiding it.
  assert.deepEqual(gateFor("/profile/cv.pdf", false), { allow: true });
  assert.equal(gateFor("/profile/edit", false).allow, false);
});
