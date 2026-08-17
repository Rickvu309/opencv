import { test } from "node:test";
import assert from "node:assert/strict";

import { afterAuthPath } from "@/lib/auth/after-auth";

test("a safe next path wins over onboarding", () => {
  assert.equal(
    afterAuthPath({ next: "/coach", needsOnboarding: true }),
    "/coach",
  );
  assert.equal(
    afterAuthPath({ next: "/paper", needsOnboarding: false }),
    "/paper",
  );
});

test("an unsafe next path is ignored", () => {
  assert.equal(
    afterAuthPath({ next: "https://not-us.example", needsOnboarding: true }),
    "/onboarding",
  );
  assert.equal(
    afterAuthPath({ next: "//not-us.example", needsOnboarding: false }),
    "/coach",
  );
  assert.equal(
    afterAuthPath({ next: "/sign-in", needsOnboarding: false }),
    "/coach",
  );
});

test("without next, a new account goes to onboarding and a returning one to the Coach", () => {
  assert.equal(afterAuthPath({ needsOnboarding: true }), "/onboarding");
  assert.equal(afterAuthPath({ needsOnboarding: false }), "/coach");
});
