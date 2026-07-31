import type { Skill, TrackRecordEntry } from "@/lib/types";

// Shared read-only helpers for the Track Record timeline: skill-area
// filtering and year grouping. Kept separate from lib/store.tsx so the page
// stays thin and testable against plain data.

/**
 * Every skill area (skill.category) that at least one confirmed entry links
 * to, in the order those categories first appear across the skill list.
 * Backs the "All plus one chip per linked skill area" filter row.
 */
export function findLinkedSkillAreas(entries: TrackRecordEntry[], skills: Skill[]): string[] {
  const linkedSkillIds = new Set(entries.flatMap((entry) => entry.skillIds));
  const areas: string[] = [];
  for (const skill of skills) {
    if (linkedSkillIds.has(skill.id) && !areas.includes(skill.category)) {
      areas.push(skill.category);
    }
  }
  return areas;
}

export function matchesSkillArea(entry: TrackRecordEntry, area: string | "all", skills: Skill[]): boolean {
  if (area === "all") return true;
  return entry.skillIds.some((skillId) => skills.find((skill) => skill.id === skillId)?.category === area);
}

export interface TrackRecordYearGroup {
  year: string;
  entries: TrackRecordEntry[];
}

/**
 * Confirmed entries grouped by year, newest year first and newest entry
 * first within each year.
 */
export function groupEntriesByYear(entries: TrackRecordEntry[]): TrackRecordYearGroup[] {
  const byYear = new Map<string, TrackRecordEntry[]>();
  for (const entry of entries) {
    const year = entry.date.slice(0, 4);
    const existing = byYear.get(year);
    if (existing) {
      existing.push(entry);
    } else {
      byYear.set(year, [entry]);
    }
  }

  return Array.from(byYear.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([year, yearEntries]) => ({
      year,
      entries: [...yearEntries].sort((a, b) => b.date.localeCompare(a.date)),
    }));
}
