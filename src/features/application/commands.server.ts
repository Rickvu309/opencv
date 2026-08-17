import { z } from "zod";
import { defineCommand } from "@/core/commands/define";
import { newId } from "@/core/ids";
import { executeCommand } from "@/core/commands/bus";
import { enqueue } from "@/core/jobs/queue";

const statuses = ["interested", "applied", "interviewing", "offer", "rejected"] as const;
const forward: Record<string, string> = {
  interested: "applied",
  applied: "interviewing",
  interviewing: "offer",
};

defineCommand({
  name: "application.create",
  agent: true,
  description: "Start tracking an application from an opening or by role and company.",
  input: z.object({
    openingId: z.string().optional(),
    role: z.string().optional(),
    company: z.string().optional(),
  }),
  async handler({ actor, input, client }) {
    let role = input.role ?? "";
    let company = input.company ?? "";
    if (input.openingId) {
      const { rows } = await client.query(
        `select title, company from openings where id=$1 and user_id=$2`,
        [input.openingId, actor.userId],
      );
      role = role || rows[0]?.title || "Role";
      company = company || rows[0]?.company || "";
    }
    const id = newId();
    await client.query(
      `insert into applications (id, user_id, opening_id, role, company, status)
       values ($1,$2,$3,$4,$5,'interested')`,
      [id, actor.userId, input.openingId ?? null, role, company],
    );
    return { result: { id }, inverse: { name: "application.remove", input: { id } } };
  },
});

defineCommand({
  name: "application.setStatus",
  agent: true,
  description: "Set application status. Forward one step at a time, backward freely, rejected from anywhere. Only when the user says reality changed.",
  input: z.object({
    id: z.string(),
    status: z.enum(statuses),
  }),
  async handler({ actor, input, client }) {
    const { rows } = await client.query(
      `select status from applications where id=$1 and user_id=$2`,
      [input.id, actor.userId],
    );
    const prev = rows[0]?.status;
    if (prev && input.status !== "rejected" && statuses.indexOf(input.status) > statuses.indexOf(prev)) {
      if (forward[prev] !== input.status) {
        throw new Error("move forward one step at a time");
      }
    }
    await client.query(
      `update applications set status=$3, updated_at=now() where id=$1 and user_id=$2`,
      [input.id, actor.userId, input.status],
    );
    return {
      result: { ok: true },
      inverse: { name: "application.setStatus", input: { id: input.id, status: prev } },
    };
  },
});

defineCommand({
  name: "application.setNotes",
  agent: true,
  description: "Save notes on an application.",
  input: z.object({ id: z.string(), notes: z.string() }),
  async handler({ actor, input, client }) {
    const { rows } = await client.query(
      `select notes from applications where id=$1 and user_id=$2`,
      [input.id, actor.userId],
    );
    await client.query(
      `update applications set notes=$3, updated_at=now() where id=$1 and user_id=$2`,
      [input.id, actor.userId, input.notes],
    );
    return {
      result: { ok: true },
      inverse: { name: "application.setNotes", input: { id: input.id, notes: rows[0]?.notes } },
    };
  },
});

defineCommand({
  name: "application.setDeadline",
  agent: true,
  description: "Set a deadline as YYYY-MM-DD.",
  input: z.object({ id: z.string(), deadline: z.string() }),
  async handler({ actor, input, client }) {
    const { rows } = await client.query(
      `select deadline, role from applications where id=$1 and user_id=$2`,
      [input.id, actor.userId],
    );
    await client.query(
      `update applications set deadline=$3, updated_at=now() where id=$1 and user_id=$2`,
      [input.id, actor.userId, input.deadline],
    );
    const when = new Date(input.deadline);
    when.setDate(when.getDate() - 1);
    await enqueue(
      "notify.deadline",
      { userId: actor.userId, applicationId: input.id, role: rows[0]?.role },
      when,
      client,
    );
    return {
      result: { ok: true },
      inverse: {
        name: "application.setDeadline",
        input: { id: input.id, deadline: rows[0]?.deadline },
      },
    };
  },
});

defineCommand({
  name: "application.tailorCv",
  agent: true,
  description: "Duplicate the master CV for this application and link the copy. Do not edit the master.",
  input: z.object({ id: z.string(), paperId: z.string() }),
  async handler({ actor, input, client }) {
    const { rows } = await client.query(
      `select role, cv_paper_id from applications where id=$1 and user_id=$2`,
      [input.id, actor.userId],
    );
    const copied = await executeCommand<{ id: string }>(
      "paper.duplicate",
      { id: input.paperId, title: `${rows[0]?.role ?? "Role"} CV` },
      actor,
      client,
    );
    await client.query(
      `update applications set cv_paper_id=$3, updated_at=now() where id=$1 and user_id=$2`,
      [input.id, actor.userId, copied.result.id],
    );
    return {
      result: { paperId: copied.result.id },
      inverse: {
        name: "application.tailorCv",
        input: { id: input.id, paperId: rows[0]?.cv_paper_id },
      },
    };
  },
});

defineCommand({
  name: "application.tailorLetter",
  agent: true,
  description: "Duplicate a letter for this application and link the copy.",
  input: z.object({ id: z.string(), paperId: z.string() }),
  async handler({ actor, input, client }) {
    const copied = await executeCommand<{ id: string }>(
      "paper.duplicate",
      { id: input.paperId, title: "Letter for this opening" },
      actor,
      client,
    );
    await client.query(
      `update applications set letter_paper_id=$3, updated_at=now() where id=$1 and user_id=$2`,
      [input.id, actor.userId, copied.result.id],
    );
    return { result: { paperId: copied.result.id }, inverse: null };
  },
});

defineCommand({
  name: "application.remove",
  agent: true,
  destructive: true,
  description: "Remove an application.",
  input: z.object({ id: z.string() }),
  async handler({ actor, input, client }) {
    await client.query(`delete from applications where id=$1 and user_id=$2`, [
      input.id,
      actor.userId,
    ]);
    return { result: { ok: true }, inverse: null };
  },
});
