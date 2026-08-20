import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { afterAuthHome, resolveSignedInHome } from "@/features/auth/signed-in-home";

describe("afterAuthHome", () => {
  it("sends incomplete onboarding to the wizard", () => {
    assert.equal(afterAuthHome({ onboardingCompleted: false, proofIds: [] }), "onboarding");
  });

  it("sends a signed-in empty account to dump, not Coach", () => {
    assert.equal(afterAuthHome({ onboardingCompleted: true, proofIds: [] }), "dump");
    assert.notEqual(afterAuthHome({ onboardingCompleted: true, proofIds: [] }), "coach");
  });

  it("sends an account with proofs to the list", () => {
    assert.equal(afterAuthHome({ onboardingCompleted: true, proofIds: ["p1"] }), "list");
  });
});

describe("resolveSignedInHome", () => {
  it("opens onboarding without minting a dump", async () => {
    let created = 0;
    const dest = await resolveSignedInHome({
      onboardingCompleted: false,
      proofIds: [],
      createDump: async () => {
        created += 1;
        return "should-not-create";
      },
    });
    assert.deepEqual(dest, { to: "/onboarding" });
    assert.equal(created, 0);
  });

  it("mints an empty proof and opens the dump editor", async () => {
    let created = 0;
    const dest = await resolveSignedInHome({
      onboardingCompleted: true,
      proofIds: [],
      createDump: async () => {
        created += 1;
        return "proof_dump";
      },
    });
    assert.equal(created, 1);
    assert.deepEqual(dest, { to: "/proof/$proofId", params: { proofId: "proof_dump" } });
  });

  it("opens the proof list when logs already exist", async () => {
    let created = 0;
    const dest = await resolveSignedInHome({
      onboardingCompleted: true,
      proofIds: ["p1"],
      createDump: async () => {
        created += 1;
        return "extra";
      },
    });
    assert.equal(created, 0);
    assert.deepEqual(dest, { to: "/proof" });
  });
});
