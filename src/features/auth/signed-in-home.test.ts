import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { afterSignInHome } from "@/features/auth/signed-in-home";

describe("afterSignInHome", () => {
  it("opens dump via proof.create when there are zero proofs", async () => {
    let created = 0;
    const dest = await afterSignInHome({
      proofs: [],
      createDump: async () => {
        created += 1;
        return "proof_dump";
      },
    });
    assert.equal(created, 1);
    assert.deepEqual(dest, { to: "/proof/$proofId", params: { proofId: "proof_dump" } });
  });

  it("reopens an empty untitled proof instead of the list", async () => {
    let created = 0;
    const dest = await afterSignInHome({
      proofs: [{ id: "already", hasLog: false }],
      createDump: async () => {
        created += 1;
        return "extra";
      },
    });
    assert.equal(created, 0);
    assert.deepEqual(dest, { to: "/proof/$proofId", params: { proofId: "already" } });
  });

  it("opens the proof list only when a proof has a log", async () => {
    let created = 0;
    const dest = await afterSignInHome({
      proofs: [{ id: "p1", hasLog: true }],
      createDump: async () => {
        created += 1;
        return "extra";
      },
    });
    assert.equal(created, 0);
    assert.deepEqual(dest, { to: "/proof" });
  });
});
