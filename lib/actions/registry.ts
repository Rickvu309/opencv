// The action registry: every change the app can make to itself, in one place.
//
// Each entry owns three things — a description the model reads, a Zod schema
// that validates input from any caller, and a pure reducer. The UI dispatches
// these; the Coach calls the same set as tools. One definition, two callers,
// so the agent can never drift from what the app can actually do.

import { z } from "zod";

import { stages, type StageId } from "@/lib/career-graph";
import type { AppState } from "./types";

export type Action<S extends z.ZodType = z.ZodType> = {
  /** Written for the model: when to use this, in plain language. */
  description: string;
  input: S;
  apply: (state: AppState, input: z.infer<S>) => AppState;
  /** One-line Vietnamese confirmation shown to the user after it runs. */
  summary: (input: z.infer<S>) => string;
};

function defineAction<S extends z.ZodType>(action: Action<S>): Action<S> {
  return action;
}

const stageIds = stages.map((s) => s.id) as [StageId, ...StageId[]];

export const actions = {
  "todo.add": defineAction({
    description:
      "Add a task to the user's Todo list. Use when the user agrees to do " +
      "something concrete, or asks you to remember a task for them.",
    input: z.object({
      title: z.string().min(1).describe("Task title, in Vietnamese"),
      detail: z.string().optional().describe("Optional one-line explanation"),
    }),
    apply: (state, { title, detail }) => ({
      ...state,
      todos: [
        {
          id: `coach-${title.slice(0, 24)}-${state.todos.length}`,
          title,
          detail,
          source: "coach" as const,
          done: false,
        },
        ...state.todos,
      ],
    }),
    summary: ({ title }) => `Đã thêm việc “${title}” vào Todo`,
  }),

  "todo.toggle": defineAction({
    description:
      "Mark a task done or not done. Only use when the user says they " +
      "finished it — never assume completion.",
    input: z.object({ id: z.string().min(1) }),
    apply: (state, { id }) => ({
      ...state,
      todos: state.todos.map((t) =>
        t.id === id ? { ...t, done: !t.done } : t,
      ),
    }),
    summary: () => "Đã cập nhật trạng thái việc",
  }),

  "todo.remove": defineAction({
    description: "Remove a task the user no longer wants to track.",
    input: z.object({ id: z.string().min(1) }),
    apply: (state, { id }) => ({
      ...state,
      todos: state.todos.filter((t) => t.id !== id),
    }),
    summary: () => "Đã xoá việc khỏi Todo",
  }),

  "vault.add": defineAction({
    description:
      "Mark a profile document as provided (CV, portfolio, cover letter, " +
      "LinkedIn, GitHub). Use only after the user confirms they added it.",
    input: z.object({
      id: z.enum(["cv", "portfolio", "cover-letter", "linkedin", "github"]),
    }),
    apply: (state, { id }) =>
      state.profile.vault.includes(id)
        ? state
        : {
            ...state,
            profile: {
              ...state.profile,
              vault: [...state.profile.vault, id],
            },
          },
    summary: ({ id }) => `Đã ghi nhận ${id} vào hồ sơ`,
  }),

  "profile.setIdentity": defineAction({
    description:
      "Update the user's display name or the role they are aiming for. " +
      "Use when they tell you their goal changed.",
    input: z.object({
      name: z.string().min(1).optional(),
      targetRole: z.string().min(1).optional(),
    }),
    apply: (state, input) => ({
      ...state,
      profile: {
        ...state.profile,
        identity: { ...state.profile.identity, ...input },
      },
    }),
    summary: ({ targetRole }) =>
      targetRole ? `Đã đổi mục tiêu sang ${targetRole}` : "Đã cập nhật hồ sơ",
  }),

  "profile.setContext": defineAction({
    description:
      "Set one row of the user's situation (goal, time available, location, " +
      "internship window). Creates the row if the label is new.",
    input: z.object({
      label: z.string().min(1),
      value: z.string().min(1),
    }),
    apply: (state, { label, value }) => {
      const exists = state.profile.context.some((r) => r.label === label);
      return {
        ...state,
        profile: {
          ...state.profile,
          context: exists
            ? state.profile.context.map((r) =>
                r.label === label ? { label, value } : r,
              )
            : [...state.profile.context, { label, value }],
        },
      };
    },
    summary: ({ label }) => `Đã cập nhật “${label}”`,
  }),

  "profile.addExperience": defineAction({
    description:
      "Add a job, internship, or activity to the user's experience list.",
    input: z.object({
      title: z.string().min(1),
      org: z.string().min(1),
      period: z.string().min(1).describe("e.g. 06/2025 – 09/2025"),
      detail: z.string().default(""),
    }),
    apply: (state, input) => ({
      ...state,
      profile: {
        ...state.profile,
        experience: [...state.profile.experience, input],
      },
    }),
    summary: ({ title }) => `Đã thêm kinh nghiệm “${title}”`,
  }),

  "plan.toggle": defineAction({
    description: "Mark a plan item complete or incomplete.",
    input: z.object({ id: z.string().min(1) }),
    apply: (state, { id }) => ({
      ...state,
      plan: { ...state.plan, [id]: !state.plan[id] },
    }),
    summary: () => "Đã cập nhật kế hoạch",
  }),

  "path.setTarget": defineAction({
    description:
      "Set which role on the career map the user is aiming for. Every route " +
      "to it lights up. Use when they commit to a direction.",
    input: z.object({ id: z.string().min(1).describe("Path node id") }),
    apply: (state, { id }) => ({
      ...state,
      paths: { ...state.paths, targetId: id },
    }),
    summary: () => "Đã đặt mục tiêu mới trên bản đồ hướng đi",
  }),

  "path.addNode": defineAction({
    description:
      "Add a role to the career map, connected from an existing node. Use " +
      "when discussing a path the map does not show yet.",
    input: z.object({
      title: z.string().min(1),
      stage: z.enum(stageIds),
      fromId: z.string().min(1).default("you"),
    }),
    apply: (state, { title, stage, fromId }) => {
      const id = `custom-${title.toLowerCase().replace(/\s+/g, "-")}`;
      return {
        ...state,
        paths: {
          ...state.paths,
          customNodes: [
            ...state.paths.customNodes,
            {
              id,
              title,
              stage,
              summary: "Hướng đi coach thêm vào bản đồ.",
              custom: true,
            },
          ],
          customEdges: [...state.paths.customEdges, { from: fromId, to: id }],
        },
      };
    },
    summary: ({ title }) => `Đã thêm “${title}” vào bản đồ hướng đi`,
  }),

  "path.removeNode": defineAction({
    description: "Remove a role the Coach or user added to the career map.",
    input: z.object({ id: z.string().min(1) }),
    apply: (state, { id }) => ({
      ...state,
      paths: {
        ...state.paths,
        targetId: state.paths.targetId === id ? null : state.paths.targetId,
        customNodes: state.paths.customNodes.filter((n) => n.id !== id),
        customEdges: state.paths.customEdges.filter(
          (e) => e.from !== id && e.to !== id,
        ),
      },
    }),
    summary: () => "Đã xoá khỏi bản đồ hướng đi",
  }),
} satisfies Record<string, Action>;

export type ActionName = keyof typeof actions;

export const actionNames = Object.keys(actions) as ActionName[];

/**
 * Erase the per-action generic at the dynamic-dispatch boundary. Indexing the
 * map by a runtime string makes TypeScript intersect every action's input type,
 * which nothing can satisfy. Safe because we parse before applying.
 */
type OpaqueAction = {
  description: string;
  input: z.ZodType;
  apply: (state: AppState, input: never) => AppState;
  summary: (input: never) => string;
};

export function lookupAction(name: string): OpaqueAction | undefined {
  return (actions as Record<string, OpaqueAction>)[name];
}

/** Validate and run an action. Throws on unknown name or bad input. */
export function applyAction(
  state: AppState,
  name: string,
  rawInput: unknown,
): { state: AppState; summary: string } {
  const action = lookupAction(name);
  if (!action) {
    throw new Error(
      `Unknown action "${name}". Available: ${actionNames.join(", ")}`,
    );
  }
  const input = action.input.parse(rawInput) as never;
  return { state: action.apply(state, input), summary: action.summary(input) };
}
