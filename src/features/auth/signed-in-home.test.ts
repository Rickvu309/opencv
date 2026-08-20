import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  afterSignInHome,
  openDump,
  proofListShowsEndOfList,
} from "@/features/auth/signed-in-home";

describe("afterSignInHome", () => {
  it("opens dump via one create when there are zero proofs", async () => {
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

  it("opens Paper when a proof has a log", async () => {
    let created = 0;
    const dest = await afterSignInHome({
      proofs: [{ id: "p1", hasLog: true }],
      createDump: async () => {
        created += 1;
        return "extra";
      },
    });
    assert.equal(created, 0);
    assert.deepEqual(dest, { to: "/paper" });
    assert.notEqual(dest.to, "/coach");
    assert.notEqual(dest.to, "/proof");
  });
});

describe("openDump", () => {
  it("creates once when there are zero proofs", async () => {
    let created = 0;
    const dest = await openDump({
      proofs: [],
      createDump: async () => {
        created += 1;
        return "new";
      },
    });
    assert.equal(created, 1);
    assert.deepEqual(dest, { to: "/proof/$proofId", params: { proofId: "new" } });
  });

  it("reuses an empty untitled and does not mint a second", async () => {
    let created = 0;
    const dest = await openDump({
      proofs: [
        { id: "logged", hasLog: true },
        { id: "empty", hasLog: false },
      ],
      createDump: async () => {
        created += 1;
        return "second";
      },
    });
    assert.equal(created, 0);
    assert.deepEqual(dest, { to: "/proof/$proofId", params: { proofId: "empty" } });
  });
});

describe("proofListShowsEndOfList", () => {
  it("hides That's all unless a real log exists", () => {
    assert.equal(proofListShowsEndOfList([]), false);
    assert.equal(proofListShowsEndOfList([{ id: "empty", hasLog: false }]), false);
    assert.equal(proofListShowsEndOfList([{ id: "p1", hasLog: true }]), true);
  });
});
