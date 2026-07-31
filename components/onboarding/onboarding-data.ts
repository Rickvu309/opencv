import { persona } from "@/lib/data/persona";
import { goals as seedGoals } from "@/lib/data/goals";
import type { Goal } from "@/lib/types";

export interface OnboardingData {
  currentRole: string;
  experienceLevel: string;
  location: string;
  strengths: string[];
  targetDirectionLabel: string;
  workStyle: "Remote" | "Hybrid" | "On-site" | "";
  companySize: string;
  nearTermPriority: string;
  selectedGoalIds: string[];
  customGoals: Goal[];
}

export const EXPERIENCE_LEVEL_OPTIONS = [
  "Mid-level (3 to 5 years)",
  "Senior (6 to 10 years)",
  "Staff or Principal (10+ years)",
  "Leadership track",
];

export const TARGET_DIRECTION_OPTIONS = [
  "AI product design",
  "Product leadership",
  "AI product design and leadership",
  "Applied AI research",
];

export const WORK_STYLE_OPTIONS: Array<"Remote" | "Hybrid" | "On-site"> = [
  "Remote",
  "Hybrid",
  "On-site",
];

export const COMPANY_SIZE_OPTIONS = [
  "Early-stage startup",
  "Growth-stage company",
  "Established company",
  "No strong preference, prioritizing the work itself",
];

export const NEAR_TERM_PRIORITY_OPTIONS = [
  "Move fast, I want to be interviewing within weeks",
  "Be selective, only pursue strong-fit roles",
  "Build proof first, strengthen my case before applying broadly",
  "Just exploring, no active urgency yet",
];

export const SUGGESTED_GOALS: Goal[] = seedGoals;

export function createEmptyOnboardingData(): OnboardingData {
  return {
    currentRole: "",
    experienceLevel: "",
    location: "",
    strengths: [],
    targetDirectionLabel: "",
    workStyle: "",
    companySize: "",
    nearTermPriority: "",
    selectedGoalIds: [],
    customGoals: [],
  };
}

export function buildExampleOnboardingData(): OnboardingData {
  return {
    currentRole: persona.currentRole,
    experienceLevel: persona.experienceLevel,
    location: persona.location,
    strengths: [...persona.strengths],
    targetDirectionLabel: persona.targetDirectionLabel,
    workStyle: persona.preferences.workStyle,
    companySize: persona.preferences.companySize,
    nearTermPriority: persona.nearTermPriority,
    selectedGoalIds: SUGGESTED_GOALS.map((goal) => goal.id),
    customGoals: [],
  };
}

export function makeGoalId(): string {
  return `goal-custom-${Math.random().toString(36).slice(2, 9)}`;
}

function addMonths(dateString: string, months: number): string {
  const date = new Date(dateString);
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

export function buildPreferencesLocation(
  location: string,
  workStyle: "Remote" | "Hybrid" | "On-site" | ""
): string {
  const place = location || "Location not set";
  if (workStyle === "Remote") return `${place} (remote-first, open to relocation for the right role)`;
  if (workStyle === "Hybrid") return `${place} (hybrid, open to occasional travel)`;
  if (workStyle === "On-site") return `${place} (on-site)`;
  return place;
}

export function createCustomGoal(title: string, targetDirectionLabel: string): Goal {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: makeGoalId(),
    title,
    why: targetDirectionLabel
      ? `Added during setup, in support of the move toward ${targetDirectionLabel}.`
      : "Added during setup.",
    targetDate: addMonths(today, 6),
    progressNote: "Just added, no progress yet.",
    status: "not started",
  };
}
