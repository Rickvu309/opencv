import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildScript, startTarget } from "./railway-role.mjs";

describe("railway-role", () => {
  it("builds the app for web", () => {
    assert.equal(buildScript("web"), "build");
    assert.deepEqual(startTarget("web"), { kind: "npm", script: "start" });
  });

  it("runs the worker when the service name contains worker", () => {
    assert.equal(buildScript("openpath-worker"), "build");
    assert.deepEqual(startTarget("openpath-worker"), { kind: "npm", script: "worker" });
  });

  it("builds Production Storybook for opath-production", () => {
    assert.equal(buildScript("opath-production"), "build-storybook");
    assert.deepEqual(startTarget("opath-production"), {
      kind: "storybook",
      dir: "storybook-static",
    });
  });

  it("builds Lab Storybook for opath-lab", () => {
    assert.equal(buildScript("opath-lab"), "build-storybook:lab");
    assert.deepEqual(startTarget("opath-lab"), {
      kind: "storybook",
      dir: "storybook-static-ui",
    });
  });

  it("uses the STORYBOOK env var when the service name is not storybook-*", () => {
    const prev = process.env.STORYBOOK;
    process.env.STORYBOOK = "lab";
    try {
      assert.equal(buildScript("web"), "build-storybook:lab");
      assert.deepEqual(startTarget("web"), { kind: "storybook", dir: "storybook-static-ui" });
    } finally {
      if (prev === undefined) delete process.env.STORYBOOK;
      else process.env.STORYBOOK = prev;
    }
  });
});
