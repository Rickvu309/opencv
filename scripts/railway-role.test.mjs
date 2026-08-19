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

  it("still accepts storybook-* service names", () => {
    assert.equal(buildScript("storybook-production"), "build-storybook");
    assert.equal(buildScript("storybook-lab"), "build-storybook:lab");
  });
});
