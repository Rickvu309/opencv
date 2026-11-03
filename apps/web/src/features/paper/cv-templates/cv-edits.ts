import type {
  CvEducation,
  CvExperience,
  CvProject,
  CvSkillGroup,
} from "./cv-types.ts"

export const EMPTY_SECTION_CTA = {
  experience: "Add first role",
  education: "Add first school",
  skills: "Add first skill",
} as const

export const BLANK_EXPERIENCE: CvExperience = {
  role: "Role title",
  company: "Company",
  period: "2024 – Present",
  bullets: ["One concrete outcome with a number…"],
}

export const BLANK_EDUCATION: CvEducation = {
  school: "School name",
  degree: "Degree · major",
  period: "2022 – 2026",
}

export const BLANK_PROJECT: CvProject = {
  name: "Project name",
  detail: "What you shipped and what changed.",
}

export const BLANK_SKILL_GROUP: CvSkillGroup = {
  label: "Skills",
  items: ["Add skill"],
}

export function addExperienceRole(
  experience: CvExperience[],
  role: CvExperience = BLANK_EXPERIENCE
): CvExperience[] {
  return [...experience, { ...role, bullets: [...role.bullets] }]
}

export function duplicateExperienceRole(
  experience: CvExperience[],
  index: number
): CvExperience[] {
  const item = experience[index]
  if (!item) return experience
  const copy: CvExperience = {
    ...item,
    bullets: [...item.bullets],
  }
  return [
    ...experience.slice(0, index + 1),
    copy,
    ...experience.slice(index + 1),
  ]
}

export function removeExperienceRole(
  experience: CvExperience[],
  index: number
): CvExperience[] {
  return experience.filter((_, i) => i !== index)
}

export function addExperienceBullet(
  experience: CvExperience[],
  index: number,
  bullet = ""
): CvExperience[] {
  return experience.map((item, i) =>
    i === index ? { ...item, bullets: [...item.bullets, bullet] } : item
  )
}

export function removeExperienceBullet(
  experience: CvExperience[],
  index: number,
  bulletIndex: number
): CvExperience[] {
  return experience.map((item, i) =>
    i === index
      ? { ...item, bullets: item.bullets.filter((_, bi) => bi !== bulletIndex) }
      : item
  )
}

export function addEducation(
  education: CvEducation[],
  school: CvEducation = BLANK_EDUCATION
): CvEducation[] {
  return [...education, { ...school }]
}

export function removeEducation(
  education: CvEducation[],
  index: number
): CvEducation[] {
  return education.filter((_, i) => i !== index)
}

export function addSkillGroup(
  skills: CvSkillGroup[],
  group: CvSkillGroup = BLANK_SKILL_GROUP
): CvSkillGroup[] {
  return [...skills, { ...group, items: [...group.items] }]
}

export function addSkillItem(
  skills: CvSkillGroup[],
  groupIndex = skills.length - 1,
  item = ""
): CvSkillGroup[] {
  if (skills.length === 0) {
    return [{ label: "Skills", items: [item] }]
  }
  const gi = Math.min(Math.max(groupIndex, 0), skills.length - 1)
  return skills.map((group, i) =>
    i === gi ? { ...group, items: [...group.items, item] } : group
  )
}

export function removeSkillItem(
  skills: CvSkillGroup[],
  groupIndex: number,
  itemIndex: number
): CvSkillGroup[] {
  return skills
    .map((group, i) =>
      i === groupIndex
        ? { ...group, items: group.items.filter((_, ii) => ii !== itemIndex) }
        : group
    )
    .filter((group) => group.items.length > 0)
}

export function renameSkillItem(
  skills: CvSkillGroup[],
  groupIndex: number,
  itemIndex: number,
  value: string
): CvSkillGroup[] {
  return skills.map((group, i) =>
    i === groupIndex
      ? {
          ...group,
          items: group.items.map((item, ii) =>
            ii === itemIndex ? value : item
          ),
        }
      : group
  )
}

export function renameSkillGroup(
  skills: CvSkillGroup[],
  groupIndex: number,
  label: string
): CvSkillGroup[] {
  return skills.map((group, i) =>
    i === groupIndex ? { ...group, label } : group
  )
}
