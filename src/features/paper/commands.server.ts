import { z } from "zod";
import { defineCommand } from "@/core/commands/define";
import { newId } from "@/core/ids";
import { emptyCv, emptyLetter, paperContentSchema } from "@/features/paper/model";
import { loadProfile } from "@/features/profile/load.server";

defineCommand({
  name: "paper.create",
  agent: true,
  description: "Create a CV or cover letter. Set fromProfile true to seed a CV from the profile.",
  input: z.object({
    kind: z.enum(["cv", "letter"]),
    template: z.string().default(""),
    situation: z.string().default(""),
    fromProfile: z.boolean().default(false),
    title: z.string().optional(),
  }),
  async handler({ actor, input, client }) {
    const id = newId();
    let content = input.kind === "cv" ? emptyCv() : emptyLetter(input.situation);
    let title = input.title ?? (input.kind === "cv" ? "Untitled CV" : "Cover letter");
    if (input.fromProfile && input.kind === "cv") {
      const profile = await loadProfile(actor.userId);
      content = {
        ...content,
        name: profile.name,
        contact: [profile.location, profile.links.map((l) => l.url).join(" · ")]
          .filter(Boolean)
          .join(" · "),
        experience: profile.experience.map((e) => ({
          id: e.id,
          org: e.org,
          role: e.role,
          dates: [e.dateFrom, e.dateTo].filter(Boolean).join(" – "),
          bullets: e.detail.length ? e.detail : [""],
        })),
        education: profile.education.school
          ? [
              {
                id: "ed1",
                school: profile.education.school,
                line: [profile.education.major, profile.education.year]
                  .filter(Boolean)
                  .join(", "),
              },
            ]
          : content.education,
        skills: profile.facts.filter((f) => /skill/i.test(f.label)).map((f) => f.value),
      };
      title = profile.targetRole ? `${profile.name || "CV"} — ${profile.targetRole}` : title;
    }
    await client.query(
      `insert into papers (id, user_id, kind, title, template, content)
       values ($1,$2,$3,$4,$5,$6::jsonb)`,
      [id, actor.userId, input.kind, title, input.template, JSON.stringify(content)],
    );
    return { result: { id }, inverse: { name: "paper.remove", input: { id } } };
  },
});

defineCommand({
  name: "paper.rename",
  agent: true,
  description: "Rename a paper.",
  input: z.object({ id: z.string(), title: z.string() }),
  async handler({ actor, input, client }) {
    const { rows } = await client.query(
      `select title from papers where id=$1 and user_id=$2`,
      [input.id, actor.userId],
    );
    await client.query(
      `update papers set title=$3, updated_at=now() where id=$1 and user_id=$2`,
      [input.id, actor.userId, input.title],
    );
    return {
      result: { ok: true },
      inverse: { name: "paper.rename", input: { id: input.id, title: rows[0]?.title } },
    };
  },
});

defineCommand({
  name: "paper.updateBlock",
  agent: true,
  description: "Update one field or block on a paper. Never rewrite the whole document.",
  input: z.object({
    id: z.string(),
    content: paperContentSchema,
  }),
  async handler({ actor, input, client }) {
    const { rows } = await client.query(
      `select content from papers where id=$1 and user_id=$2`,
      [input.id, actor.userId],
    );
    await client.query(
      `update papers set content=$3::jsonb, updated_at=now() where id=$1 and user_id=$2`,
      [input.id, actor.userId, JSON.stringify(input.content)],
    );
    return {
      result: { ok: true },
      inverse: { name: "paper.updateBlock", input: { id: input.id, content: rows[0]?.content } },
    };
  },
});

defineCommand({
  name: "paper.updateSection",
  agent: true,
  description: "Hide or show a CV section without deleting its content.",
  input: z.object({ id: z.string(), section: z.string(), hidden: z.boolean() }),
  async handler({ actor, input, client }) {
    const { rows } = await client.query(
      `select content from papers where id=$1 and user_id=$2`,
      [input.id, actor.userId],
    );
    const content = paperContentSchema.parse(rows[0]?.content ?? {});
    const prev = Boolean(content.hidden[input.section]);
    content.hidden[input.section] = input.hidden;
    await client.query(
      `update papers set content=$3::jsonb, updated_at=now() where id=$1 and user_id=$2`,
      [input.id, actor.userId, JSON.stringify(content)],
    );
    return {
      result: { ok: true },
      inverse: {
        name: "paper.updateSection",
        input: { id: input.id, section: input.section, hidden: prev },
      },
    };
  },
});

defineCommand({
  name: "paper.setTemplate",
  agent: true,
  description: "Assign a CV situation template.",
  input: z.object({ id: z.string(), template: z.string() }),
  async handler({ actor, input, client }) {
    const { rows } = await client.query(
      `select template from papers where id=$1 and user_id=$2`,
      [input.id, actor.userId],
    );
    await client.query(
      `update papers set template=$3, updated_at=now() where id=$1 and user_id=$2`,
      [input.id, actor.userId, input.template],
    );
    return {
      result: { ok: true },
      inverse: { name: "paper.setTemplate", input: { id: input.id, template: rows[0]?.template } },
    };
  },
});

defineCommand({
  name: "paper.setTheme",
  agent: true,
  description: "Set density tight or normal.",
  input: z.object({ id: z.string(), density: z.enum(["normal", "tight"]) }),
  async handler({ actor, input, client }) {
    const { rows } = await client.query(
      `select content from papers where id=$1 and user_id=$2`,
      [input.id, actor.userId],
    );
    const content = paperContentSchema.parse(rows[0]?.content ?? {});
    const prev = content.density;
    content.density = input.density;
    await client.query(
      `update papers set content=$3::jsonb, updated_at=now() where id=$1 and user_id=$2`,
      [input.id, actor.userId, JSON.stringify(content)],
    );
    return {
      result: { ok: true },
      inverse: { name: "paper.setTheme", input: { id: input.id, density: prev } },
    };
  },
});

defineCommand({
  name: "paper.duplicate",
  agent: true,
  description: "Copy a paper. Used to tailor for one job without changing the master.",
  input: z.object({ id: z.string(), title: z.string().optional() }),
  async handler({ actor, input, client }) {
    const { rows } = await client.query(
      `select * from papers where id=$1 and user_id=$2`,
      [input.id, actor.userId],
    );
    const src = rows[0] as
      | {
          id: string;
          kind: string;
          title: string;
          template: string;
          language: string;
          content: unknown;
        }
      | undefined;
    if (!src) return { result: { id: "" }, inverse: null };
    const id = newId();
    await client.query(
      `insert into papers (id, user_id, kind, title, template, language, content, source_paper_id)
       values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`,
      [
        id,
        actor.userId,
        src.kind,
        input.title ?? `${src.title} copy`,
        src.template,
        src.language,
        JSON.stringify(src.content ?? {}),
        src.id,
      ],
    );
    return { result: { id }, inverse: { name: "paper.remove", input: { id } } };
  },
});

defineCommand({
  name: "paper.addProofLine",
  agent: true,
  description: "Add one published Proof as a line on a CV. Never automatic.",
  input: z.object({ paperId: z.string(), line: z.string() }),
  async handler({ actor, input, client }) {
    const { rows } = await client.query(
      `select content from papers where id=$1 and user_id=$2`,
      [input.paperId, actor.userId],
    );
    const content = paperContentSchema.parse(rows[0]?.content ?? {});
    content.proofLines = [...content.proofLines, input.line];
    await client.query(
      `update papers set content=$3::jsonb, updated_at=now() where id=$1 and user_id=$2`,
      [input.paperId, actor.userId, JSON.stringify(content)],
    );
    return { result: { ok: true }, inverse: null };
  },
});

defineCommand({
  name: "paper.uploadFile",
  agent: false,
  description: "Store an uploaded CV or letter for preview. Does not parse it into a paper.",
  input: z.object({
    filename: z.string(),
    mime: z.string(),
    bytesBase64: z.string(),
  }),
  async handler({ actor, input, client }) {
    const bytes = Buffer.from(input.bytesBase64, "base64");
    if (bytes.length > 5 * 1024 * 1024) throw new Error("that file is larger than 5 MB");
    const id = newId();
    await client.query(
      `insert into files (id, user_id, purpose, filename, mime, size, bytes)
       values ($1,$2,'upload',$3,$4,$5,$6)`,
      [id, actor.userId, input.filename, input.mime, bytes.length, bytes],
    );
    return { result: { id }, inverse: { name: "paper.removeFile", input: { id } } };
  },
});

defineCommand({
  name: "paper.removeFile",
  agent: false,
  destructive: true,
  description: "Remove an uploaded file.",
  input: z.object({ id: z.string() }),
  async handler({ actor, input, client }) {
    await client.query(`delete from files where id=$1 and user_id=$2`, [input.id, actor.userId]);
    return { result: { ok: true }, inverse: null };
  },
});

defineCommand({
  name: "paper.remove",
  agent: true,
  destructive: true,
  description: "Delete a paper.",
  input: z.object({ id: z.string() }),
  async handler({ actor, input, client }) {
    await client.query(`delete from papers where id=$1 and user_id=$2`, [
      input.id,
      actor.userId,
    ]);
    return { result: { ok: true }, inverse: null };
  },
});
