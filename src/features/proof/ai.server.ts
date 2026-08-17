import { complete } from "@/core/ai/gateway";
import { loadProfile } from "@/features/profile/load.server";
import { z } from "zod";

const storySchema = z.object({
  what: z.string(),
  did: z.string(),
  came: z.string(),
  missing: z.enum(["what", "did", "came", "none"]),
});

export async function interviewQuestion(
  userId: string,
  title: string,
  entries: { body: string }[],
) {
  const log = entries.map((e) => e.body).join("\n");
  const ai = await complete({
    role: "drafting",
    userId,
    system:
      "Ask one specific question that pulls a concrete detail from the user's Proof log. Never suggest a fact. Never use an exclamation mark. Prefer what / how / what came of it.",
    prompt: `Proof: ${title}\nLog:\n${log || "(empty)"}`,
  });
  if (ai.unavailable) {
    if (!log) return "What was this, in one concrete sentence?";
    if (log.length < 80) return "What did you actually do with your own hands?";
    return "What came of it, in words you can defend?";
  }
  return ai.text.trim();
}

export async function arrangeStory(
  userId: string,
  title: string,
  entries: { body: string }[],
) {
  const profile = await loadProfile(userId);
  const log = entries.map((e) => e.body).join("\n");
  const ai = await complete({
    role: "drafting",
    userId,
    system:
      "Arrange a Proof log into three parts: what it was, what they did, what came of it. Use only the log and profile. If a part is missing, leave it empty and set missing. Never invent numbers.",
    prompt: `Title: ${title}\nLog:\n${log}\nProfile: ${JSON.stringify(profile)}`,
    schema: storySchema,
  });
  if (ai.unavailable || !ai.object) {
    const text = log || "";
    return {
      what: text.slice(0, 280),
      did: "",
      came: "",
      missing: text ? ("did" as const) : ("what" as const),
    };
  }
  return storySchema.parse(ai.object);
}

export function storyUsesOnlyLog(story: { what: string; did: string; came: string }, log: string) {
  const blob = `${story.what} ${story.did} ${story.came}`;
  const percents = blob.match(/\d{2,3}\s*%/g) ?? [];
  return percents.every((p) => log.includes(p.replace(/\s/g, "")) || log.includes(p));
}
