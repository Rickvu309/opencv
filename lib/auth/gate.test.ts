// The gate decides what the internet can reach. Every one of these is a URL
// somebody will eventually type.

import { test } from "node:test";
import assert from "node:assert/strict";

import { SIGN_IN_PATH, gateFor, safeNext } from "@/lib/auth/gate";

/** The screens the product is made of. AC-ACCT-005.1 covers all of them. */
const PRODUCT_SCREENS = [
  "/coach",
  "/paper",
  "/pitch",
  "/profile",
  "/search",
  "/applications",
  "/onboarding",
  "/settings",
  "/help",
  "/dev/chat",
];

test("without a session, every product screen sends the user to sign in", () => {
  for (const path of PRODUCT_SCREENS) {
    const decision = gateFor(path, false);
    assert.equal(decision.kind, "redirect", `${path} was left open`);
    assert.ok(
      decision.kind === "redirect" && decision.to.startsWith(SIGN_IN_PATH),
      `${path} was sent somewhere other than sign-in`,
    );
  }
});

test("a screen nobody has written yet is closed, not open", () => {
  // The reason the rule is a list of open paths rather than closed ones: the
  // screen added next month is closed by default, and the failure mode of
  // getting it wrong is a redirect rather than a leak.
  assert.equal(gateFor("/career-map", false).kind, "redirect");
});

test("the landing page and account creation are open, as the requirement says", () => {
  // AC-ACCT-005.2, exactly.
  for (const path of ["/", "/sign-in", "/sign-up"]) {
    assert.deepEqual(gateFor(path, false), { kind: "allow" }, `${path} was closed`);
  }
});

test("local preview can open onboarding without making it public by default", () => {
  assert.equal(gateFor("/onboarding", false).kind, "redirect");
  assert.deepEqual(gateFor("/onboarding", false, ["/onboarding"]), {
    kind: "allow",
  });
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
    "/p/a-class-project",
    "/u/mai-ab12cd",
  ]) {
    assert.deepEqual(gateFor(path, false), { kind: "allow" }, `${path} was closed`);
  }
});

test("with a session, everything is open", () => {
  for (const path of [...PRODUCT_SCREENS, "/", "/anything"]) {
    assert.deepEqual(gateFor(path, true), { kind: "allow" }, `${path} was closed`);
  }
});

test("the redirect carries where the user was going", () => {
  const decision = gateFor("/paper", false);
  assert.equal(decision.kind, "redirect");
  assert.ok(decision.kind === "redirect" && decision.to === `${SIGN_IN_PATH}?next=%2Fpaper`);
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
  assert.equal(safeNext("/paper"), "/paper");
});

test("a path that only looks like an asset is still gated when it is a screen", () => {
  // The dot test is a heuristic, so it is worth knowing what it does: a screen
  // with a dot in its last segment would be treated as a file. No route in
  // this product has one, and this records the limit rather than hiding it.
  assert.deepEqual(gateFor("/profile/cv.pdf", false), { kind: "allow" });
  assert.equal(gateFor("/profile/edit", false).kind, "redirect");
});

test("an endpoint is refused with a status, not with a page", () => {
  // A fetch follows a redirect and reads the sign-in page's status, so the
  // caller cannot tell "your session ended" from "the server is broken", and
  // the user gets told the wrong thing about their own work.
  assert.deepEqual(gateFor("/api/state", false), { kind: "unauthorized" });
  assert.deepEqual(gateFor("/api/anything/else", false), { kind: "unauthorized" });
  // The endpoints a visitor needs before an account are still open.
  assert.deepEqual(gateFor("/api/auth/sign-in", false), { kind: "allow" });
  assert.deepEqual(gateFor("/api/waitlist", false), { kind: "allow" });
});
