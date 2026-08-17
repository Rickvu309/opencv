import { pathNodes } from "@/lib/catalogue";

/**
 * Quiet payback while someone types a goal. Not a score — a known direction
 * either matches a role we can talk about, or we take the words as written.
 */
export function knownDirection(goal: string): string | null {
  const needle = goal.trim().toLowerCase();
  if (needle.length < 3) return null;
  const hit = pathNodes.find((node) => {
    const title = node.title.toLowerCase();
    return title.includes(needle) || needle.includes(title);
  });
  return hit?.title ?? null;
}
