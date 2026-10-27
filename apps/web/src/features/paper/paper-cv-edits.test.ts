import { describe, expect, it } from "vitest"

import { defaultCvData } from "./paper-cv-types.ts"
import {
  addEducation,
  addExperienceBullet,
  addExperienceRole,
  addSkillItem,
  BLANK_EDUCATION,
  duplicateExperienceRole,
  EMPTY_SECTION_CTA,
  removeEducation,
  removeExperienceBullet,
  removeExperienceRole,
  removeSkillItem,
  renameSkillGroup,
  renameSkillItem,
} from "./paper-cv-edits.ts"

const sample = defaultCvData()

describe("experience row primitives (QVE-207)", () => {
  it("adds and deletes a bullet on one role", () => {
    const withBullet = addExperienceBullet(
      sample.experience,
      0,
      "Shipped a café board"
    )
    expect(withBullet[0]?.bullets).toHaveLength(3)
    expect(withBullet[0]?.bullets.at(-1)).toBe("Shipped a café board")
    expect(withBullet[1]?.bullets).toHaveLength(2)

    const removed = removeExperienceBullet(withBullet, 0, 2)
    expect(removed[0]?.bullets).toEqual(sample.experience[0]?.bullets)
  })

  it("duplicates and removes a role without touching the other", () => {
    const duplicated = duplicateExperienceRole(sample.experience, 0)
    expect(duplicated).toHaveLength(3)
    expect(duplicated[1]).toEqual(sample.experience[0])
    expect(duplicated[1]).not.toBe(sample.experience[0])
    expect(duplicated[1]?.bullets).not.toBe(sample.experience[0]?.bullets)

    const removed = removeExperienceRole(duplicated, 1)
    expect(removed).toEqual(sample.experience)
  })

  it("appends a blank role", () => {
    const next = addExperienceRole(sample.experience)
    expect(next).toHaveLength(3)
    expect(next[2]?.role).toBe("Role title")
  })
})

describe("education row primitives (QVE-209)", () => {
  it("appends a blank school and can remove it", () => {
    const next = addEducation(sample.education)
    expect(next).toHaveLength(2)
    expect(next[1]).toEqual(BLANK_EDUCATION)
    expect(next[1]).not.toBe(BLANK_EDUCATION)
    expect(removeEducation(next, 1)).toEqual(sample.education)
  })
})

describe("empty section CTA copy (QVE-209)", () => {
  it("names one quiet next step per section", () => {
    expect(EMPTY_SECTION_CTA.experience).toBe("Add first role")
    expect(EMPTY_SECTION_CTA.education).toBe("Add first school")
    expect(EMPTY_SECTION_CTA.skills).toBe("Add first skill")
  })
})

describe("skill chip primitives (QVE-207)", () => {
  it("renames, adds, and removes chips in the named group", () => {
    const renamed = renameSkillItem(sample.skills, 0, 0, "Café interviews")
    expect(renamed[0]?.items[0]).toBe("Café interviews")
    expect(renamed[1]?.items[0]).toBe(sample.skills[1]?.items[0])

    const added = addSkillItem(renamed, 0, "PRDs on paper")
    expect(added[0]?.items.at(-1)).toBe("PRDs on paper")

    const removed = removeSkillItem(added, 0, 0)
    expect(removed[0]?.items).not.toContain("Café interviews")
    expect(removed[0]?.items).toContain("PRDs on paper")
  })

  it("creates a group when skills are empty and drops empty groups", () => {
    const created = addSkillItem([], 0, "SQL basics")
    expect(created).toEqual([{ label: "Skills", items: ["SQL basics"] }])
    expect(removeSkillItem(created, 0, 0)).toEqual([])
  })

  it("renames a skill group label", () => {
    expect(renameSkillGroup(sample.skills, 1, "Toolkit")[1]?.label).toBe(
      "Toolkit"
    )
  })
})
