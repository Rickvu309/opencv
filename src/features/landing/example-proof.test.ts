import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { withClient } from "@/core/db/client.server";
import { testDatabaseUrl, withTestSchema } from "@/core/db/testing";
import { demoProof } from "@/features/landing/model";

describe("demo Proof card", () => {
  it("seeds a published café-shift page at /p/demo", async (t) => {
    if (!testDatabaseUrl()) {
      t.skip("TEST_DATABASE_URL is not set");
      return;
    }
    await withTestSchema(async () => {
      const { rows } = await withClient((c) =>
        c.query<{ slug: string; content: { what?: string; did?: string } }>(
          `select slug, content from proof_pages where slug=$1`,
          [demoProof.slug],
        ),
      );
      assert.equal(rows.length, 1);
      assert.equal(rows[0]?.content.what, demoProof.sentences[0]);
      assert.equal(rows[0]?.content.did, demoProof.sentences[1]);
    });
  });

  it("puts the published card in the hole under the composer", () => {
    const src = readFileSync(
      fileURLToPath(new URL("./components/landing-page.tsx", import.meta.url)),
      "utf8",
    );
    assert.match(src, /For students and new graduates/);
    assert.match(src, /Write to the Coach/);
    assert.match(src, /Start now/);
    assert.doesNotMatch(src, />\s*Sign up\s*</);
    assert.doesNotMatch(src, /See an example|Example/);
    assert.match(src, /demoProof/);
    assert.match(src, /Copy link/);
    assert.match(src, /\/p\/\$\{demoProof\.slug\}|\/p\/demo/);
    assert.doesNotMatch(src, /aspect-\[9\/16\]/);
  });
});
