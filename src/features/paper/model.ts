import { z } from "zod";

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
