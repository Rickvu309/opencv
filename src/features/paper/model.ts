import { z } from "zod";
import type { Profile } from "@/features/profile/model";

export const templates = [
  { id: "vn-employer", label: "Vietnamese employer", word: "CV" as const, photo: true },
  { id: "internship", label: "Internship / first role", word: "CV" as const, photo: true },
  { id: "academic", label: "Academic / scholarship", word: "CV" as const, photo: false },
  { id: "service", label: "Part-time / service work", word: "CV" as const, photo: true },
  { id: "one-page", label: "Fits one page", word: "CV" as const, photo: false },
  { id: "ats", label: "Abroad / ATS", word: "Resume" as const, photo: false },
  { id: "technical", label: "Technical", word: "Resume" as const, photo: false },
  { id: "design", label: "Design / portfolio", word: "Resume" as const, photo: false },
];

export const letterSituations = [
  { id: "posted", label: "A posted job" },
  { id: "internship", label: "An internship" },
  { id: "speculative", label: "A company with no posting" },
  { id: "scholarship", label: "A scholarship" },
];

export const paperContentSchema = z.object({
  density: z.enum(["normal", "tight"]).default("normal"),
  hidden: z.record(z.string(), z.boolean()).default({}),
  name: z.string().default(""),
  contact: z.string().default(""),
  experience: z
    .array(
      z.object({
        id: z.string(),
        org: z.string(),
        role: z.string(),
        dates: z.string(),
        bullets: z.array(z.string()),
      }),
    )
    .default([]),
  education: z
    .array(
      z.object({
        id: z.string(),
        school: z.string(),
        line: z.string(),
      }),
    )
    .default([]),
  skills: z.array(z.string()).default([]),
  proofLines: z.array(z.string()).default([]),
  paragraphs: z.array(z.string()).default([]),
  situation: z.string().default(""),
});

export type PaperContent = z.infer<typeof paperContentSchema>;

export function emptyCv(): PaperContent {
  return paperContentSchema.parse({
    experience: [{ id: "e1", org: "", role: "", dates: "", bullets: [""] }],
    education: [{ id: "ed1", school: "", line: "" }],
    skills: [""],
  });
}

export function emptyLetter(situation: string): PaperContent {
  return paperContentSchema.parse({
    situation,
    paragraphs: ["", "", ""],
  });
}

export function typeWord(kind: string, template: string) {
  if (kind === "letter") return "Cover letter";
  return templates.find((t) => t.id === template)?.word ?? "CV";
}

export const cvSections = ["experience", "education", "skills", "proof"] as const;
export type CvSection = (typeof cvSections)[number];

export const letterGhosts: Record<string, [string, string, string]> = {
  posted: [
    "I'm writing about the role at this organisation.",
    "The work that matches: one result, with a number if you have one.",
    "I can start on a date I actually have, and this is how to reach me.",
  ],
  internship: [
    "I'm writing about the internship at this organisation.",
    "What I can already do: one piece of work, with a number if you have one.",
    "When I can start, and how to reach me.",
  ],
  speculative: [
    "I'm writing to this organisation, even though there is no posting.",
    "The work that would help them: one result, with a number if you have one.",
    "When I can start, and how to reach me.",
  ],
  scholarship: [
    "I'm writing about this scholarship.",
    "The work that supports the application: one result, with a number if you have one.",
    "When I can start, and how to reach me.",
  ],
};

export function letterGhostsFor(situation: string): [string, string, string] {
  return letterGhosts[situation] ?? [
    "Write the opening.",
    "Write why you fit, from work you actually did.",
    "Write the close: when you can start, and how to reach you.",
  ];
}

export function profileLinesOnPage(profile: Profile, content: PaperContent) {
  const checks: boolean[] = [];
  if (profile.name.trim()) {
    checks.push(content.name.trim().length > 0);
  }
  for (const item of profile.experience) {
    if (!item.role.trim() && !item.org.trim()) continue;
    const onPage = content.experience.some(
      (row) =>
        (row.id === item.id || (row.role === item.role && row.org === item.org)) &&
        (row.role.trim().length > 0 || row.org.trim().length > 0),
    );
    checks.push(onPage);
  }
  if (profile.education.school.trim()) {
    checks.push(content.education.some((row) => row.school.trim().length > 0));
  }
  for (const fact of profile.facts.filter((f) => /skill/i.test(f.label))) {
    if (!fact.value.trim()) continue;
    const needle = fact.value.toLowerCase();
    checks.push(content.skills.some((skill) => skill.toLowerCase().includes(needle)));
  }
  return { onPage: checks.filter(Boolean).length, total: checks.length };
}

export function completenessCopy(onPage: number, total: number) {
  if (total === 0) return "";
  const noun = total === 1 ? "line" : "lines";
  const verb = onPage === 1 ? "is" : "are";
  return `${onPage} of ${total} profile ${noun} ${verb} on this page.`;
}

export function relativeUpdated(iso: string, now = Date.now()) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.max(0, Math.floor((now - then) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 minute ago";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return "1 hour ago";
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return "1 month ago";
  if (months < 12) return `${months} months ago`;
  const years = Math.floor(days / 365);
  if (years === 1) return "1 year ago";
  return `${years} years ago`;
}
