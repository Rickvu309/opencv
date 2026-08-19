import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { createStorybookServer, resolvePublicFile } from "./storybook-serve.mjs";

describe("storybook-serve", () => {
  it("keeps iframe.html as a real file and does not rewrite it to /iframe", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "sb-"));
    const resolved = resolvePublicFile(root, "/iframe.html?id=onboarding-wizard--goal");
    assert.equal(resolved, path.join(root, "iframe.html"));
  });

  it("rejects path traversal", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "sb-"));
    assert.equal(resolvePublicFile(root, "/../../etc/passwd"), null);
  });

  it("serves iframe.html with 200 and /iframe with 404", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "sb-"));
    fs.writeFileSync(path.join(root, "index.html"), "<p>manager</p>");
    fs.writeFileSync(path.join(root, "iframe.html"), "<p>preview</p>");
    const server = createStorybookServer(root);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();
    try {
      const preview = await fetch(`http://127.0.0.1:${port}/iframe.html?id=x`);
      assert.equal(preview.status, 200);
      assert.equal(await preview.text(), "<p>preview</p>");
      const stripped = await fetch(`http://127.0.0.1:${port}/iframe`);
      assert.equal(stripped.status, 404);
      const home = await fetch(`http://127.0.0.1:${port}/`);
      assert.equal(home.status, 200);
      assert.equal(await home.text(), "<p>manager</p>");
    } finally {
      server.close();
    }
  });
});
