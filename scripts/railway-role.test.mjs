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

  it("builds Production Storybook", () => {
    assert.equal(buildScript("storybook-production"), "build-storybook");
    assert.deepEqual(startTarget("storybook-production"), {
      kind: "storybook",
      dir: "storybook-static",
    });
  });

  it("builds Lab Storybook when the name includes lab", () => {
    assert.equal(buildScript("storybook-lab"), "build-storybook:lab");
    assert.deepEqual(startTarget("storybook-lab"), {
      kind: "storybook",
      dir: "storybook-static-ui",
    });
  });
});
