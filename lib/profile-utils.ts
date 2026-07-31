import type { Profile } from "@/lib/types";

// Shared read-only helper for the Profile page's strength meter. Kept
// separate from lib/store.tsx so the score always reads live off the
// current profile in state, with no separate percent to keep in sync.

export interface ProfileStrengthCheck {
  id: string;
  label: string;
  passed: boolean;
  prompt: string;
}

export interface ProfileStrengthPrompt {
  id: string;
  text: string;
}

export interface ProfileStrengthResult {
  percent: number;
  prompts: ProfileStrengthPrompt[];
  checks: ProfileStrengthCheck[];
}

const HAS_DIGIT = /\d/;

/**
 * Every check the strength meter runs against the current profile. Each
 * check is worth an equal share of the percent, and a failed check becomes
 * a candidate improvement prompt, most specific first.
 */
export function computeProfileStrength(profile: Profile): ProfileStrengthResult {
  const entryMissingOutcome = profile.experience.find(
    (entry) => !entry.bullets.some((bullet) => HAS_DIGIT.test(bullet))
  );

  const checks: ProfileStrengthCheck[] = [
    {
      id: "headline",
      label: "Headline set",
      passed: profile.headline.trim().length > 0,
      prompt: "Add a headline that names your target direction.",
    },
    {
      id: "summary",
      label: "Summary written",
      passed: profile.summary.trim().length > 0,
      prompt: "Write a professional summary.",
    },
    {
      id: "target-direction",
      label: "Target direction set",
      passed: profile.targetDirection.trim().length > 0,
      prompt: "Set your target direction.",
    },
    {
      id: "experience-bullets",
      label: "Every role has impact bullets",
      passed: profile.experience.every(
        (entry) => entry.bullets.length >= 2 && entry.bullets.every((bullet) => bullet.trim().length > 0)
      ),
      prompt: "Add impact bullets to every role in Experience.",
    },
    {
      id: "experience-outcomes",
      label: "Every role names an outcome number",
      passed: !entryMissingOutcome,
      prompt: entryMissingOutcome
        ? `Add an outcome number to your ${entryMissingOutcome.company} role.`
        : "",
    },
    {
      id: "strengths-count",
      label: "At least 4 strengths listed",
      passed: profile.strengths.length >= 4,
      prompt: "Add another strength to your Strengths grid.",
    },
    {
      id: "work-mode",
      label: "Work mode set",
      passed: profile.preferences.workStyle.trim().length > 0,
      prompt: "Set your work mode in Preferences and constraints.",
    },
    {
      id: "company-size",
      label: "Company size preference set",
      passed: profile.preferences.companySize.trim().length > 0,
      prompt: "Set a company size preference.",
    },
    {
      id: "salary-floor",
      label: "Salary floor set",
      passed: profile.preferences.salaryFloor.trim().length > 0,
      prompt: "Set a salary floor in Preferences and constraints.",
    },
    {
      id: "location-constraints",
      label: "Location constraints set",
      passed: profile.preferences.location.trim().length > 0,
      prompt: "Set your location constraints.",
    },
    {
      id: "deal-breakers",
      label: "Deal breakers listed",
      passed: profile.preferences.dealBreakers.length > 0,
      prompt: "Add your deal breakers to Preferences and constraints.",
    },
  ];

  const passedCount = checks.filter((check) => check.passed).length;
  const percent = Math.round((passedCount / checks.length) * 100);
  const prompts = checks
    .filter((check) => !check.passed)
    .slice(0, 2)
    .map((check) => ({ id: check.id, text: check.prompt }));

  return { percent, prompts, checks };
}
