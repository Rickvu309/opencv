import { z } from "zod";
import { defineCommand } from "@/core/commands/define";
import { newId } from "@/core/ids";

defineCommand({
  name: "profile.update",
  agent: true,
  description: "Update the user's name, target role, location, or time available.",
  input: z.object({
    name: z.string().optional(),
    targetRole: z.string().nullable().optional(),
    location: z.string().optional(),
    timeAvailable: z.string().optional(),
    summary: z.string().optional(),
  }),
  async handler({ actor, input, client }) {
    const { rows } = await client.query(
      `select name, target_role, location, time_available, summary from profiles where user_id = $1`,
      [actor.userId],
    );
    const prev = rows[0];
    await client.query(
      `update profiles set
        name = coalesce($2, name),
        target_role = case when $3::text = '__skip' then target_role else $4 end,
        location = coalesce($5, location),
        time_available = coalesce($6, time_available),
        summary = coalesce($7, summary),
        updated_at = now()
       where user_id = $1`,
      [
        actor.userId,
        input.name ?? null,
        input.targetRole === undefined ? "__skip" : "set",
        input.targetRole === undefined ? null : input.targetRole,
        input.location ?? null,
        input.timeAvailable ?? null,
        input.summary ?? null,
      ],
    );
    return {
      result: { ok: true },
      inverse: {
        name: "profile.update",
        input: {
          name: prev.name,
          targetRole: prev.target_role,
          location: prev.location,
          timeAvailable: prev.time_available,
          summary: prev.summary,
        },
      },
    };
  },
});

defineCommand({
  name: "profile.addFact",
  agent: true,
  description: "Add a labelled fact about the user.",
  input: z.object({ label: z.string(), value: z.string() }),
  async handler({ actor, input, client }) {
    const id = newId();
    await client.query(
      `insert into profile_facts (id, user_id, label, value) values ($1,$2,$3,$4)`,
      [id, actor.userId, input.label, input.value],
    );
    return {
      result: { id },
      inverse: { name: "profile.removeFact", input: { id } },
    };
  },
});

defineCommand({
  name: "profile.updateFact",
  agent: true,
  description: "Edit a stored fact.",
  input: z.object({ id: z.string(), label: z.string(), value: z.string() }),
  async handler({ actor, input, client }) {
    const { rows } = await client.query(
      `select label, value from profile_facts where id = $1 and user_id = $2`,
      [input.id, actor.userId],
    );
    const prev = rows[0];
    await client.query(
      `update profile_facts set label = $3, value = $4 where id = $1 and user_id = $2`,
      [input.id, actor.userId, input.label, input.value],
    );
    return {
      result: { ok: true },
      inverse: { name: "profile.updateFact", input: { id: input.id, ...prev } },
    };
  },
});

defineCommand({
  name: "profile.removeFact",
  agent: true,
  destructive: true,
  description: "Remove a stored fact. Requires confirmation.",
  input: z.object({ id: z.string() }),
  async handler({ actor, input, client }) {
    const { rows } = await client.query(
      `delete from profile_facts where id = $1 and user_id = $2 returning label, value`,
      [input.id, actor.userId],
    );
    const prev = rows[0];
    return {
      result: { ok: true },
      inverse: prev
        ? { name: "profile.addFact", input: { label: prev.label, value: prev.value } }
        : null,
    };
  },
});

defineCommand({
  name: "profile.addExperience",
  agent: true,
  description: "Add a work or project experience. Detail lines should be results.",
  input: z.object({
    org: z.string(),
    role: z.string(),
    dateFrom: z.string().default(""),
    dateTo: z.string().default(""),
    detail: z.array(z.string()).default([]),
  }),
  async handler({ actor, input, client }) {
    const id = newId();
    await client.query(
      `insert into profile_experiences (id, user_id, org, role, date_from, date_to, detail)
       values ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
      [id, actor.userId, input.org, input.role, input.dateFrom, input.dateTo, JSON.stringify(input.detail)],
    );
    return { result: { id }, inverse: { name: "profile.removeExperience", input: { id } } };
  },
});

defineCommand({
  name: "profile.updateExperience",
  agent: true,
  description: "Update one experience entry.",
  input: z.object({
    id: z.string(),
    org: z.string(),
    role: z.string(),
    dateFrom: z.string(),
    dateTo: z.string(),
    detail: z.array(z.string()),
  }),
  async handler({ actor, input, client }) {
    const { rows } = await client.query(
      `select org, role, date_from, date_to, detail from profile_experiences where id = $1 and user_id = $2`,
      [input.id, actor.userId],
    );
    const prev = rows[0];
    await client.query(
      `update profile_experiences set org=$3, role=$4, date_from=$5, date_to=$6, detail=$7::jsonb
       where id=$1 and user_id=$2`,
      [input.id, actor.userId, input.org, input.role, input.dateFrom, input.dateTo, JSON.stringify(input.detail)],
    );
    return {
      result: { ok: true },
      inverse: prev
        ? {
            name: "profile.updateExperience",
            input: {
              id: input.id,
              org: prev.org,
              role: prev.role,
              dateFrom: prev.date_from,
              dateTo: prev.date_to,
              detail: prev.detail,
            },
          }
        : null,
    };
  },
});

defineCommand({
  name: "profile.removeExperience",
  agent: true,
  destructive: true,
  description: "Remove an experience entry.",
  input: z.object({ id: z.string() }),
  async handler({ actor, input, client }) {
    await client.query(
      `delete from profile_experiences where id = $1 and user_id = $2`,
      [input.id, actor.userId],
    );
    return { result: { ok: true }, inverse: null };
  },
});

defineCommand({
  name: "profile.setEducation",
  agent: true,
  description: "Set school, major, year, GPA, and courses.",
  input: z.object({
    school: z.string(),
    major: z.string(),
    year: z.string(),
    gpa: z.string().default(""),
    courses: z.array(z.string()).default([]),
  }),
  async handler({ actor, input, client }) {
    const { rows } = await client.query(
      `select school, major, year, gpa, courses from profile_education where user_id = $1`,
      [actor.userId],
    );
    const prev = rows[0];
    await client.query(
      `insert into profile_education (user_id, school, major, year, gpa, courses)
       values ($1,$2,$3,$4,$5,$6::jsonb)
       on conflict (user_id) do update set school=$2, major=$3, year=$4, gpa=$5, courses=$6::jsonb`,
      [actor.userId, input.school, input.major, input.year, input.gpa, JSON.stringify(input.courses)],
    );
    return {
      result: { ok: true },
      inverse: prev
        ? {
            name: "profile.setEducation",
            input: {
              school: prev.school,
              major: prev.major,
              year: prev.year,
              gpa: prev.gpa,
              courses: prev.courses,
            },
          }
        : null,
    };
  },
});

defineCommand({
  name: "profile.setLink",
  agent: true,
  description: "Set a LinkedIn, GitHub, or portfolio URL.",
  input: z.object({
    kind: z.enum(["linkedin", "github", "portfolio"]),
    url: z.string(),
  }),
  async handler({ actor, input, client }) {
    const id = newId();
    await client.query(
      `insert into profile_links (id, user_id, kind, url) values ($1,$2,$3,$4)
       on conflict (user_id, kind) do update set url = $4`,
      [id, actor.userId, input.kind, input.url],
    );
    return { result: { ok: true }, inverse: { name: "profile.removeLink", input: { kind: input.kind } } };
  },
});

defineCommand({
  name: "profile.removeLink",
  agent: true,
  destructive: true,
  description: "Remove an external link.",
  input: z.object({ kind: z.enum(["linkedin", "github", "portfolio"]) }),
  async handler({ actor, input, client }) {
    await client.query(
      `delete from profile_links where user_id = $1 and kind = $2`,
      [actor.userId, input.kind],
    );
    return { result: { ok: true }, inverse: null };
  },
});
