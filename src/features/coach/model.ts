import { z } from "zod";

export const appOpenPlaces = [
  "chat",
  "paper",
  "proof",
  "pitch",
  "search",
  "apply",
  "profile",
  "settings",
] as const;

export const appOpenInputSchema = z.object({
  place: z.enum(appOpenPlaces),
  paperId: z.string().optional(),
  proofId: z.string().optional(),
  applicationId: z.string().optional(),
});

export type AppOpenInput = z.infer<typeof appOpenInputSchema>;

export const appOpenResultSchema = z.discriminatedUnion("ok", [
  appOpenInputSchema.extend({ ok: z.literal(true) }),
  z.object({ ok: z.literal(false), error: z.string() }),
]);

export type AppOpenResult = z.infer<typeof appOpenResultSchema>;

export const toolCallSchema = z.object({
  id: z.string(),
  name: z.string(),
  input: z.unknown().optional(),
  status: z.enum(["pending", "completed", "failed"]),
  output: z.unknown().optional(),
});

export type ToolCallView = z.infer<typeof toolCallSchema>;

export const approvalSchema = z.object({
  command: z.string(),
  input: z.unknown(),
  description: z.string(),
});

export type ApprovalView = z.infer<typeof approvalSchema>;
