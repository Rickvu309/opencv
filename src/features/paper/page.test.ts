import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const SATURDAY_CLOSE =
  "Saturday close. We ran out of oat milk and I stayed until the last table left.";

describe("opened editor source", () => {
  const src = readFileSync(fileURLToPath(new URL("./components/page.tsx", import.meta.url)), "utf8");

  it("does not ship CV ghost strings", () => {
    assert.equal(src.includes("Your name"), false);
    assert.equal(src.includes("Email · phone · city"), false);
    assert.equal(src.includes("A result, with a number if you have one"), false);
  });

  it("keeps the Saturday-close line as published words", () => {
    const stories = readFileSync(
      fileURLToPath(new URL("./components/page.stories.tsx", import.meta.url)),
      "utf8",
    );
    assert.equal(stories.includes(SATURDAY_CLOSE), true);
    assert.equal(stories.includes("cut wait time by 40%"), false);
    assert.equal(src.includes("cut wait time by 40%"), false);
  });
});
