// Initial app state, derived from the mock data module.
//
// This is the only file that reads lib/data.ts to build state. When a real
// backend lands, replace this function and nothing above it changes.

import { defaultTargetId } from "@/lib/career-graph";
import {
  actionPlan,
  careerContext,
  coachTodos,
  profileSnapshot,
  user,
  vaultItems,
  type Todo,
} from "@/lib/data";
import type { AppState } from "./types";

export function seedState(): AppState {
  const planTodos: Todo[] = actionPlan.flatMap((phase) =>
    phase.items.map((item) => ({
      id: item.id,
      title: item.title,
      detail: item.description,
      source: "plan" as const,
      phase: phase.label,
      effort: item.effort,
      resource: item.resource,
      done: item.done,
    })),
  );

  const quickWinTodos: Todo[] = profileSnapshot.quickWins.map((title, i) => ({
    id: `win-${i}`,
    title,
    source: "coach" as const,
    effort: "Làm được ngay",
    done: false,
  }));

  return {
    profile: {
      identity: { name: user.name, targetRole: user.targetRole },
      context: careerContext.map((row) => ({ ...row })),
      experience: user.experience.map((e) => ({ ...e })),
      education: {
        school: user.school,
        major: user.major,
        year: user.year,
        gpa: user.gpa,
        courses: [...user.courses],
      },
      vault: vaultItems.filter((v) => v.done).map((v) => v.id),
    },
    todos: [...planTodos, ...coachTodos, ...quickWinTodos],
    plan: Object.fromEntries(
      actionPlan.flatMap((p) => p.items.map((i) => [i.id, i.done])),
    ),
    paths: {
      targetId: defaultTargetId,
      customNodes: [],
      customEdges: [],
    },
  };
}
