import { withClient } from "@/core/db/client.server";
import type { Profile } from "@/features/profile/model";

export async function loadProfile(userId: string): Promise<Profile> {
  return withClient(async (c) => {
    const profile = (
      await c.query(
        `select name, target_role, location, time_available, summary from profiles where user_id = $1`,
        [userId],
      )
    ).rows[0] ?? {
      name: "",
      target_role: null,
      location: "",
      time_available: "",
      summary: "",
    };
    const facts = (
      await c.query(`select id, label, value from profile_facts where user_id = $1`, [userId])
    ).rows;
    const experience = (
      await c.query<{
        id: string;
        org: string;
        role: string;
        date_from: string;
        date_to: string;
        detail: string[] | null;
      }>(
        `select id, org, role, date_from, date_to, detail from profile_experiences where user_id = $1`,
        [userId],
      )
    ).rows;
    const education = (
      await c.query(
        `select school, major, year, gpa, courses from profile_education where user_id = $1`,
        [userId],
      )
    ).rows[0] ?? { school: "", major: "", year: "", gpa: "", courses: [] };
    const links = (
      await c.query(`select id, kind, url from profile_links where user_id = $1`, [userId])
    ).rows;
    return {
      name: profile.name,
      targetRole: profile.target_role,
      location: profile.location,
      timeAvailable: profile.time_available,
      summary: profile.summary,
      facts,
      experience: experience.map((e) => ({
        id: e.id,
        org: e.org,
        role: e.role,
        dateFrom: e.date_from,
        dateTo: e.date_to,
        detail: e.detail ?? [],
      })),
      education,
      links,
    };
  });
}
