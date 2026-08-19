import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { profileCanStartCv, profileNextStep } from "@/features/profile/next-step";

describe("profile next step", () => {
  it("points at adding a fact on first run", () => {
    assert.deepEqual(
      profileNextStep({
        empty: true,
        experienceCount: 0,
        factCount: 0,
        hasSchool: false,
        linkCount: 0,
      }),
      { id: "facts", label: "Add a fact" },
    );
  });

  it("fills the highest-weight empty section first", () => {
    assert.equal(
      profileNextStep({
        empty: false,
        experienceCount: 0,
        factCount: 0,
        hasSchool: false,
        linkCount: 0,
      }).id,
      "experience",
    );
    assert.equal(
      profileNextStep({
        empty: false,
        experienceCount: 1,
        factCount: 0,
        hasSchool: false,
        linkCount: 0,
      }).id,
      "facts",
    );
    assert.equal(
      profileNextStep({
        empty: false,
        experienceCount: 1,
        factCount: 1,
        hasSchool: false,
        linkCount: 0,
      }).id,
      "education",
    );
    assert.equal(
      profileNextStep({
        empty: false,
        experienceCount: 1,
        factCount: 1,
        hasSchool: true,
        linkCount: 0,
      }).id,
      "links",
    );
    assert.equal(
      profileNextStep({
        empty: false,
        experienceCount: 1,
        factCount: 1,
        hasSchool: true,
        linkCount: 1,
      }).id,
      "cv",
    );
  });

  it("offers Start a CV once name and school or experience are there", () => {
    assert.equal(
      profileCanStartCv({ name: "Ánh", experienceCount: 0, hasSchool: true }),
      true,
    );
    assert.equal(
      profileCanStartCv({ name: "Ánh", experienceCount: 1, hasSchool: false }),
      true,
    );
    assert.equal(
      profileCanStartCv({ name: "", experienceCount: 1, hasSchool: true }),
      false,
    );
  });
});
