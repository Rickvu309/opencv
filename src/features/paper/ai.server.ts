import { complete } from "@/core/ai/gateway";
import { loadProfile } from "@/features/profile/load.server";

export async function sharpenBullet(userId: string, bullet: string) {
  const profile = await loadProfile(userId);
  const facts = JSON.stringify(profile);
  const ai = await complete({
    role: "drafting",
    userId,
    system:
      "Rewrite one CV bullet as a result. Use only facts given. Never invent a number. No exclamation marks.",
    prompt: `Profile: ${facts}\nBullet: ${bullet}`,
  });
  if (ai.unavailable) {
    return bullet.replace(/responsible for /i, "").trim();
  }
  return ai.text.trim() || bullet;
}

export async function draftLetter(userId: string, role: string, company: string) {
  const profile = await loadProfile(userId);
  const ai = await complete({
    role: "drafting",
    userId,
    system:
      "Draft a short cover letter in three paragraphs from the profile only. No invented facts. No exclamation marks.",
    prompt: `Role: ${role} at ${company}\nProfile: ${JSON.stringify(profile)}`,
  });
  if (ai.unavailable) {
    return [
      `I am writing about the ${role} role at ${company}.`,
      profile.experience[0]
        ? `I most recently ${profile.experience[0].detail[0] || `worked as ${profile.experience[0].role} at ${profile.experience[0].org}`}.`
        : "I can add a specific example from my work once we pick one.",
      "I would like to talk about how I can help.",
    ];
  }
  return ai.text.split(/\n\s*\n/).filter(Boolean);
}
