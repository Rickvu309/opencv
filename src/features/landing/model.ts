import { z } from "zod";

export const demoProofSchema = z.object({
  slug: z.literal("demo"),
  date: z.string(),
  title: z.string(),
  sentences: z.tuple([z.string(), z.string()]),
});

export const demoProof = demoProofSchema.parse({
  slug: "demo",
  date: "8 Aug 2026",
  title: "Saturday close",
  sentences: [
    "I closed the café on Saturday after the other closer called out.",
    "I wrote a one-page close list so the next Saturday could lock on time.",
  ],
});
