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

export const paperBlockKeys = [
  "name",
  "contact",
  "experience",
  "education",
  "skills",
  "proofLines",
  "paragraphs",
  "situation",
] as const;
export type PaperBlockKey = (typeof paperBlockKeys)[number];

export const paperBlockPatchSchema = z
  .object({
    name: z.string().optional(),
    contact: z.string().optional(),
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
      .optional(),
    education: z
      .array(z.object({ id: z.string(), school: z.string(), line: z.string() }))
      .optional(),
    skills: z.array(z.string()).optional(),
    proofLines: z.array(z.string()).optional(),
    paragraphs: z.array(z.string()).optional(),
    situation: z.string().optional(),
  })
  .refine((patch) => paperBlockKeys.filter((key) => patch[key] !== undefined).length === 1, {
    message: "update exactly one block",
  });

export type PaperBlockPatch = z.infer<typeof paperBlockPatchSchema>;

export function patchKeys(patch: Partial<Pick<PaperContent, PaperBlockKey>>): PaperBlockKey[] {
  return paperBlockKeys.filter((key) => patch[key] !== undefined);
}

export function applyPaperPatch(
  content: PaperContent,
  patch: Partial<Pick<PaperContent, PaperBlockKey>>,
): PaperContent {
  const next: PaperContent = { ...content };
  for (const key of patchKeys(patch)) {
    const value = patch[key];
    if (value !== undefined) {
      next[key] = value as never;
    }
  }
  return paperContentSchema.parse(next);
}

export function paperIdFromScreen(screen: string) {
  const match = screen.match(/^\/paper\/([^/]+)$/);
  return match?.[1] ?? null;
}

export type PublishedProofLine = { date: string; words: string };

export function cvLineFromPublishedProof(page: {
  date?: string | null;
  words?: string | null;
  what?: string | null;
  did?: string | null;
  came?: string | null;
}): PublishedProofLine | null {
  const words = page.words?.trim() ?? "";
  if (!words) return null;
  return { date: page.date?.trim() ?? "", words };
}

export type PaperCanvas =
  | { kind: "dashed" }
  | { kind: "cv"; paperId: string | null; lines: PublishedProofLine[] };

export function paperCanvas(input: {
  cvId?: string | null;
  published: Array<{
    date?: string | null;
    words?: string | null;
    what?: string | null;
    did?: string | null;
    came?: string | null;
  }>;
}): PaperCanvas {
  const lines = input.published
    .map(cvLineFromPublishedProof)
    .filter((line): line is PublishedProofLine => line !== null);
  if (!input.cvId && lines.length === 0) return { kind: "dashed" };
  return { kind: "cv", paperId: input.cvId ?? null, lines };
}

export function emptyCv(): PaperContent {
  return paperContentSchema.parse({});
}

export function isTypedExperience(row: PaperContent["experience"][number]) {
  return Boolean(
    row.role.trim() ||
      row.org.trim() ||
      row.dates.trim() ||
      row.bullets.some((bullet) => bullet.trim()),
  );
}

export function isTypedEducation(row: PaperContent["education"][number]) {
  return Boolean(row.school.trim() || row.line.trim());
}

export function openedCvPage(content: PaperContent) {
  return {
    name: content.name.trim() || null,
    contact: content.contact.trim() || null,
    showExperienceHeading:
      !content.hidden.experience && content.experience.some(isTypedExperience),
    experience: content.hidden.experience ? [] : content.experience,
    showEducationHeading:
      !content.hidden.education && content.education.some(isTypedEducation),
    education: content.hidden.education ? [] : content.education,
    showSkillsHeading: !content.hidden.skills && content.skills.some((skill) => skill.trim()),
    skills: content.hidden.skills ? [] : content.skills,
  };
}

export function keepPublishedProofWords(
  bullet: string,
  published: PublishedProofLine[],
): string | null {
  const match = published.find((line) => line.words.trim() === bullet.trim());
  return match ? match.words : null;
}

export function openedPaperEditRule(published: PublishedProofLine[]) {
  const words = published.map((line) => line.words).filter((line) => line.trim());
  const base =
    "When an opened paper snapshot is present, edit that paper in place with paper.updateBlock or paper.updateSection. Pass exactly one content key to paper.updateBlock. Duplicate only when they ask to tailor. Do not invent numbers. Do not rewrite the whole document.";
  if (!words.length) return base;
  return `${base} Published Proof lines on this page are read-only. They are already the same words as /p/:slug: ${JSON.stringify(words)}. Do not rewrite, STAR, ghostwrite, or invent a number for those lines. Do not call paper.sharpenLine, paper.updateBlock, or paper.addProofLine on them. Ask Coach cannot ghostwrite a published Proof line.`;
}

export function excerptEditRule(
  excerpt: { text: string; label?: string },
  published: PublishedProofLine[],
) {
  const where = excerpt.label ? ` (${excerpt.label})` : "";
  const base = `User highlighted on this page${where}: ${excerpt.text}\nThat is the line they mean.`;
  if (keepPublishedProofWords(excerpt.text, published)) {
    return `${base}\nThat excerpt is a published Proof line. Leave those words as they are. Do not rewrite, STAR, or invent a number.`;
  }
  return base;
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
