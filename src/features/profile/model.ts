import { z } from "zod";

export const factSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.string(),
});

export const experienceSchema = z.object({
  id: z.string(),
  org: z.string(),
  role: z.string(),
  dateFrom: z.string(),
  dateTo: z.string(),
  detail: z.array(z.string()),
});

export const educationSchema = z.object({
  school: z.string(),
  major: z.string(),
  year: z.string(),
  gpa: z.string(),
  courses: z.array(z.string()),
});

export const linkSchema = z.object({
  id: z.string(),
  kind: z.enum(["linkedin", "github", "portfolio"]),
  url: z.string(),
});

export const profileSchema = z.object({
  name: z.string(),
  targetRole: z.string().nullable(),
  location: z.string(),
  timeAvailable: z.string(),
  summary: z.string(),
  facts: z.array(factSchema),
  experience: z.array(experienceSchema),
  education: educationSchema,
  links: z.array(linkSchema),
});

export type Profile = z.infer<typeof profileSchema>;

export function completeness(p: Profile) {
  let score = 0;
  if (p.facts.length) score += 18;
  if (p.experience.length) score += 22;
  if (p.education.school) score += 12;
  if (p.education.courses.length) score += 8;
  if (p.links.some((l) => l.kind === "portfolio")) score += 18;
  if (p.links.some((l) => l.kind === "linkedin")) score += 12;
  if (p.links.some((l) => l.kind === "github")) score += 10;
  return score;
}

export function profilePlaintext(p: Profile) {
  return [
    p.name,
    p.targetRole ?? "",
    p.location,
    ...p.facts.map((f) => `${f.label} ${f.value}`),
    ...p.experience.flatMap((e) => [e.org, e.role, ...e.detail]),
    p.education.school,
    p.education.major,
    ...p.education.courses,
  ]
    .join(" ")
    .toLowerCase();
}
