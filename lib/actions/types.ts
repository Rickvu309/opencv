// The shape of everything the Coach is allowed to see and change.
//
// Deliberately excludes UI-local state (canvas viewport, popover open, sidebar
// width). Those are presentation concerns; the agent has no business touching
// them, and keeping them out means every field here is safe to expose as a tool.

import type { PathEdge, PathNode } from "@/lib/career-graph";
import type { Todo, VaultItemId } from "@/lib/data";

export type Experience = {
  title: string;
  org: string;
  period: string;
  detail: string;
};

export type AppState = {
  profile: {
    identity: { name: string; targetRole: string };
    /** Label/value rows shown under the profile's context section. */
    context: { label: string; value: string }[];
    experience: Experience[];
    education: {
      school: string;
      major: string;
      year: string;
      gpa: string;
      courses: string[];
    };
    /** Vault slots the user has filled. */
    vault: VaultItemId[];
  };
  todos: Todo[];
  /** Plan item id → done. Kept flat so a toggle is one key. */
  plan: Record<string, boolean>;
  paths: {
    targetId: string | null;
    customNodes: PathNode[];
    customEdges: PathEdge[];
  };
};
